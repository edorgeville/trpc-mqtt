import { createTRPCProxyClient } from '@trpc/client';
import Aedes from 'aedes';
import { once } from 'events';
import mqtt from 'mqtt';
import { createServer } from 'net';

import { createMQTTHandler } from '../src/adapter';
import { mqttLink } from '../src/link';
import { AppRouter, appRouter } from './appRouter';

export async function factory() {
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

  await once(broker, 'listening');
  await once(mqttClient, 'connect');

  return {
    client,
    broker,
    mqttClient,
    close() {
      mqttClient.end();
      broker.close();
      aedes.close();
    }
  };
}
