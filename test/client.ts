import { createTRPCProxyClient } from '@trpc/client';
import mqtt from 'mqtt';

import { mqttLink } from '../src/link';
import type { AppRouter } from './appRouter';

const client = mqtt.connect('mqtt://localhost');

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    mqttLink({
      client,
      requestTopic: 'rpc/request'
    })
  ]
});

const main = async () => {
  const greeting = await trpc.greet.query('world');
  console.log(greeting);
  console.log('Closing MQTT client...');
  client.end();
  console.log('MQTT client closed.');
};

main();
