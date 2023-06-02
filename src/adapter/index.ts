import {
  AnyRouter,
  ProcedureType,
  TRPCError,
  callProcedure,
  inferRouterContext
} from '@trpc/server';
import type { OnErrorFunction } from '@trpc/server/dist/internals/types';
import mqtt, { MqttClient } from 'mqtt';

import { getErrorFromUnknown } from './errors';

// import * as amqp from 'amqp-connection-manager';
type ConsumeMessage = string;

const MQTT_METHOD_PROCEDURE_TYPE_MAP: Record<string, ProcedureType | undefined> = {
  query: 'query',
  mutation: 'mutation'
};

export type CreateMQTTHandlerOptions<TRouter extends AnyRouter> = {
  url: string;
  requestTopic: string;
  router: TRouter;
  mqttOptions?: MqttClient['options'];
  onError?: OnErrorFunction<TRouter, ConsumeMessage>;
  verbose?: boolean;
};

export const createMQTTHandler = <TRouter extends AnyRouter>(
  opts: CreateMQTTHandlerOptions<TRouter>
) => {
  const { url, requestTopic: requestTopic, router, onError, mqttOptions, verbose } = opts;

  const client = mqtt.connect(url, { ...mqttOptions, protocolVersion: 5 });
  client.subscribe(requestTopic);
  client.on('message', async (topic, message, packet) => {
    const msg = message.toString();
    if (verbose) console.log(topic, msg);
    if (!msg) return;
    const correlationId = packet.properties?.correlationData?.toString();
    const responseTopic = packet.properties?.responseTopic?.toString();
    if (!correlationId || !responseTopic) return;
    const res = await handleMessage(router, msg, onError);
    if (!res) return;
    client.publish(responseTopic, Buffer.from(JSON.stringify({ trpc: res })), {
      properties: {
        correlationData: Buffer.from(correlationId)
      }
    });
  });
  return { close: () => client.end() };
};

async function handleMessage<TRouter extends AnyRouter>(
  router: TRouter,
  msg: ConsumeMessage,
  onError?: OnErrorFunction<TRouter, ConsumeMessage>
) {
  const { transformer } = router._def._config;

  try {
    const message = JSON.parse(msg);
    if (!('trpc' in message)) return;
    const { trpc } = message;
    if (!('id' in trpc) || trpc.id === null || trpc.id === undefined) return;
    if (!trpc) return;

    const { id, params } = trpc;
    const type = MQTT_METHOD_PROCEDURE_TYPE_MAP[trpc.method] ?? ('query' as const);
    const ctx: inferRouterContext<TRouter> | undefined = undefined;

    try {
      const path = params.path;

      if (!path) {
        throw new Error('No path provided');
      }

      if (type === 'subscription') {
        throw new TRPCError({
          message: 'MQTT link does not support subscriptions (yet?)',
          code: 'METHOD_NOT_SUPPORTED'
        });
      }

      const deserializeInputValue = (rawValue: unknown) => {
        return typeof rawValue !== 'undefined' ? transformer.input.deserialize(rawValue) : rawValue;
      };

      const input = deserializeInputValue(params.input);

      const output = await callProcedure({
        procedures: router._def.procedures,
        path,
        rawInput: input,
        ctx,
        type
      });

      return {
        id,
        result: {
          type: 'data',
          data: output
        }
      };
    } catch (cause) {
      const error = getErrorFromUnknown(cause);
      onError?.({
        error,
        type,
        path: trpc?.path,
        input: trpc?.input,
        ctx,
        req: msg
      });

      return {
        id,
        error: router.getErrorShape({
          error,
          type,
          path: trpc?.path,
          input: trpc?.input,
          ctx
        })
      };
    }
  } catch (cause) {
    // TODO: Assume json parsing error (so shouldn't happen), but we need to handle this better
    return {};
  }
}
