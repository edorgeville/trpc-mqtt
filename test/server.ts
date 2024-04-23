import mqtt from 'mqtt';

import { createMQTTHandler } from '../src/adapter';
import { appRouter } from './appRouter';

const client = mqtt.connect('mqtt://localhost');

createMQTTHandler({
  client,
  requestTopic: 'rpc/request',
  router: appRouter
});

process.on('SIGINT', () => {
  console.log('Closing MQTT client...');
  client.end();
  console.log('MQTT client closed.');
});
