import { factory } from './factory';

test('broker is listening', async () => {
  const { broker, close } = await factory();

  expect(broker.listening).toBe(true);

  close();
});

test('mqtt client is connected', async () => {
  const { mqttClient, close } = await factory();

  expect(mqttClient.connected).toBe(true);

  close();
});

test('greet query', async () => {
  const { client, close } = await factory();

  const greeting = await client.greet.query('world');
  expect(greeting).toEqual({ greeting: 'hello, world!' });

  close();
});

test('countUp mutation', async () => {
  const { client, close } = await factory();

  const addOne = await client.countUp.mutate(1);
  expect(addOne).toBe(1);

  const addTwo = await client.countUp.mutate(2);
  expect(addTwo).toBe(3);

  close();
});

test('abortSignal is handled', async () => {
  const { client, close } = await factory();

  const controller = new AbortController();
  const promise = client.slow.query(undefined, {
    signal: controller.signal
  });

  controller.abort();
  await expect(promise).rejects.toThrow('aborted');

  close();
});
