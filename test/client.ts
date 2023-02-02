import { createTRPCProxyClient } from '@trpc/client';

import { mqttLink } from '../src/link';
import type { AppRouter } from './appRouter';

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    mqttLink({
      url: 'mqtt://localhost',
      requestTopic: 'rpc/request'
    })
  ]
});

const main = async () => {
  const greeting = await trpc.greet.query('world');
  console.log(greeting);
};

main();
