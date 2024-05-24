import { createTRPCProxyClient } from '@trpc/client';
import Aedes from 'aedes';
import { once } from 'events';
import mqtt from 'mqtt';
import { createServer } from 'net';

import { createMQTTHandler } from '../src/adapter';
import { mqttLink } from '../src/link';
import { AppRouter, appRouter } from './appRouter';

const requestTopic = 'rpc/request';

const aedes = new Aedes();
// aedes.on('publish', (packet, client) => console.log(packet.topic, packet.payload.toString()));
const broker = createServer(aedes.handle);
broker.listen(1883);
const mqttClient = mqtt.connect('mqtt://localhost');

createMQTTHandler({
  client: mqttClient,
  requestTopic,
  router: appRouter
});

const client = createTRPCProxyClient<AppRouter>({
  links: [
    mqttLink({
      client: mqttClient,
      requestTopic
    })
  ]
});

beforeAll(async () => {
  await once(broker, 'listening');
  await once(mqttClient, 'connect');
});

test('broker is listening', () => {
  expect(broker.listening).toBe(true);
});

test('mqtt client is connected', () => {
  expect(mqttClient.connected).toBe(true);
});

test('greet query', async () => {
  const greeting = await client.greet.query('world');
  expect(greeting).toEqual({ greeting: 'hello, world!' });
});

test('countUp mutation', async () => {
  const addOne = await client.countUp.mutate(1);
  expect(addOne).toBe(1);

  const addTwo = await client.countUp.mutate(2);
  expect(addTwo).toBe(3);
});

test('abortSignal is handled & event listeners cleaned up', async () => {
  const controller = new AbortController();
  const promise = client.takesASecondToResolve.query(undefined, {
    signal: controller.signal
  });

  controller.abort();
  await expect(promise).rejects.toThrow('aborted');

  // Only the server should still be listening, client should have cleaned up
  expect(mqttClient.listeners('message').length).toBe(1);
});

afterAll(async () => {
  mqttClient.end();
  broker.close();
  aedes.close();
});
