import { createMQTTHandler } from '../src/adapter';
import { appRouter } from './appRouter';

createMQTTHandler({
  url: 'mqtt://localhost',
  requestTopic: 'rpc/request',
  router: appRouter
});
