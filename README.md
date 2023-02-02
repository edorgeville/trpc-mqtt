<div align="center">
  <img src="assets/trpc-rabbitmq-readme.png?v=2" alt="trpc-mqtt" />
  <h1>trpc-mqtt</h1>
  <a href="https://www.npmjs.com/package/trpc-mqtt"><img src="https://img.shields.io/npm/v/trpc-mqtt.svg?style=flat&color=brightgreen" target="_blank" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-black" /></a>
  <br />
  <hr />
</div>


## Usage

**1. Install `trpc-mqtt`.**

```bash
# npm
npm install trpc-mqtt
# yarn
yarn add trpc-mqtt
# pnpm
pnpm add trpc-mqtt
```

**2. Use `mqttLink` in your client code.**

```typescript
import { createTRPCProxyClient } from '@trpc/client';
import { mqttLink } from 'trpc-mqtt/link';

import type { AppRouter } from './appRouter';

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    mqttLink({
      url: "mqtt://localhost",
      queue: "rpc/request"
    })
  ],
});
```

**3. Use `createRMQHandler` to handle incoming calls via mqtt on the server.**

```typescript
import { createRMQHandler } from 'trpc-mqtt/adapter';

import { appRouter } from './appRouter';

createRMQHandler({ 
  url: "mqtt://localhost",
  queue: "rpc/request",
  router: appRouter
});
```

## License

Distributed under the MIT License. See LICENSE for more information.

## Special thanks
This project is a fork of [trpc-rabbitmq](https://github.com/alexbrazier/trpc-rabbitmq) by [Alex Brazier](https://github.com/imxeno)
