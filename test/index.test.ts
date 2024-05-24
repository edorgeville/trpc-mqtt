import { withFactory } from './factory';

describe('broker', () => {
  test('is listening', async () => {
    await withFactory(async ({ broker }) => {
      expect(broker.listening).toBe(true);
    });
  });
});

describe('mqtt client', () => {
  test('is connected', async () => {
    await withFactory(async ({ mqttClient }) => {
      expect(mqttClient.connected).toBe(true);
    });
  });
});

describe('procedures', () => {
  test('greet query', async () => {
    await withFactory(async ({ client }) => {
      const greeting = await client.greet.query('world');
      expect(greeting).toEqual({ greeting: 'hello, world!' });
    });
  });

  test('countUp mutation', async () => {
    await withFactory(async ({ client }) => {
      const addOne = await client.countUp.mutate(1);
      expect(addOne).toBe(1);

      const addTwo = await client.countUp.mutate(2);
      expect(addTwo).toBe(3);
    });
  });

  describe('abort signal', () => {
    test('is handled', async () => {
      await withFactory(async ({ client }) => {
        const controller = new AbortController();
        const promise = client.slow.query(undefined, {
          signal: controller.signal
        });

        controller.abort();
        await expect(promise).rejects.toThrow('aborted');
      });
    });
  });
});

describe('context', () => {
  test('getContext query', async () => {
    await withFactory(async ({ client }) => {
      const ctx = await client.getContext.query();
      expect(ctx).toEqual({ hello: 'world' });
    });
  });
});
