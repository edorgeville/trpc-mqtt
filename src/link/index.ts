import { TRPCClientError, TRPCLink } from '@trpc/client';
import type { AnyRouter } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { randomUUID } from 'crypto';
import EventEmitter from 'events';
import mqtt, { MqttClient } from 'mqtt';

import type { TRPCMQTTRequest, TRPCMQTTResponse } from '../types';

export type TRPCMQTTLinkOptions = {
  url: string;
  requestTopic: string;
  responseTopic?: string;
  mqttOptions?: MqttClient['options'];
  requestTimeoutMs?: number;
};

export const mqttLink = <TRouter extends AnyRouter>(
  opts: TRPCMQTTLinkOptions
): TRPCLink<TRouter> => {
  return runtime => {
    const {
      url,
      requestTopic,
      mqttOptions,
      responseTopic = `${requestTopic}/response`,
      requestTimeoutMs = 5000
    } = opts;
    const responseEmitter = new EventEmitter();
    responseEmitter.setMaxListeners(0);

    const client = mqtt.connect(url, { ...mqttOptions, protocolVersion: 5 });
    client.subscribe(responseTopic);
    client.on('error', err => {
      throw err;
    });
    client.on('message', (topic, message, packet) => {
      const msg = message.toString();
      const correlationData = packet.properties?.correlationData?.toString();
      if (correlationData === undefined) return;
      responseEmitter.emit(correlationData, JSON.parse(msg));
    });

    const request = async (message: TRPCMQTTRequest) =>
      new Promise<any>((resolve, reject) => {
        const correlationId = randomUUID();
        const onTimeout = () => {
          responseEmitter.off(correlationId, onMessage);
          reject(new TRPCClientError('Request timed out after ' + requestTimeoutMs + 'ms'));
        };
        const timeout = setTimeout(onTimeout, requestTimeoutMs);
        const onMessage = (message: TRPCMQTTResponse) => {
          clearTimeout(timeout);
          resolve(message);
        };
        responseEmitter.once(correlationId, onMessage);
        const opts = {
          properties: {
            responseTopic,
            correlationData: Buffer.from(correlationId)
          }
        };
        client.publish(requestTopic, JSON.stringify(message), opts);
      });

    return ({ op }) => {
      return observable(observer => {
        const { id, type, path } = op;

        try {
          const input = runtime.transformer.serialize(op.input);

          const onMessage = (message: TRPCMQTTResponse) => {
            if (!('trpc' in message)) return;
            const { trpc } = message;
            if (!trpc) return;
            if (!('id' in trpc) || trpc.id === null || trpc.id === undefined) return;
            if (id !== trpc.id) return;

            if ('error' in trpc) {
              const error = runtime.transformer.deserialize(trpc.error);
              observer.error(TRPCClientError.from({ ...trpc, error }));
              return;
            }

            observer.next({
              result: {
                ...trpc.result,
                ...((!trpc.result.type || trpc.result.type === 'data') && {
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  data: runtime.transformer.deserialize(trpc.result.data)!
                })
              }
            });

            observer.complete();
          };

          request({
            trpc: {
              id,
              method: type,
              params: { path, input }
            }
          })
            .then(onMessage)
            .catch(cause => {
              observer.error(
                new TRPCClientError(cause instanceof Error ? cause.message : 'Unknown error')
              );
            });
        } catch (cause) {
          observer.error(
            new TRPCClientError(cause instanceof Error ? cause.message : 'Unknown error')
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-empty-function, prettier/prettier
        return () => { };
      });
    };
  };
};
