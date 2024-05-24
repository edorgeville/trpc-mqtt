import { TRPCClientError, TRPCLink } from '@trpc/client';
import type { AnyRouter } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { randomUUID } from 'crypto';
import EventEmitter from 'events';
import type { MqttClient } from 'mqtt';

import type { TRPCMQTTRequest, TRPCMQTTResponse } from '../types';

export type TRPCMQTTLinkOptions = {
  client: MqttClient;
  requestTopic: string;
  responseTopic?: string;
  requestTimeoutMs?: number;
};

export const mqttLink = <TRouter extends AnyRouter>(
  opts: TRPCMQTTLinkOptions
): TRPCLink<TRouter> => {
  // This runs once, at the initialization of the link
  return runtime => {
    const {
      client,
      requestTopic,
      responseTopic = `${requestTopic}/response`,
      requestTimeoutMs = 5000
    } = opts;
    const responseEmitter = new EventEmitter();
    responseEmitter.setMaxListeners(0);

    const protocolVersion = client.options.protocolVersion ?? 4;

    client.subscribe(responseTopic);
    client.on('message', (topic, message, packet) => {
      if (responseTopic !== topic) return; // Ignore messages not on the response topic, from other users of the shared client
      const msg = message.toString();
      if (protocolVersion >= 5) {
        const correlationData = packet.properties?.correlationData?.toString();
        if (correlationData === undefined) return;
        responseEmitter.emit(correlationData, JSON.parse(msg));
      } else {
        let correlationId: string | undefined;
        try {
          const parsed = JSON.parse(msg);
          correlationId = parsed.correlationId;
        } catch (err) {
          return;
        }
        if (correlationId === undefined) return;
        responseEmitter.emit(correlationId, JSON.parse(msg));
      }
    });

    return ({ op }) => {
      // This runs every time a procedure is called
      return observable(observer => {
        const abortController = new AbortController();

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

          const request = async (message: TRPCMQTTRequest, signal: AbortSignal) =>
            new Promise<any>((resolve, reject) => {
              const correlationId = randomUUID();
              const onTimeout = () => {
                responseEmitter.off(correlationId, onMessage);
                signal.onabort = null;
                reject(new TRPCClientError('Request timed out after ' + requestTimeoutMs + 'ms'));
              };
              const onAbort = () => {
                // This runs when the request is aborted externally
                clearTimeout(timeout);
                responseEmitter.off(correlationId, onMessage);
                reject(new TRPCClientError('Request aborted'));
              };
              const timeout = setTimeout(onTimeout, requestTimeoutMs);
              signal.onabort = onAbort;
              const onMessage = (message: TRPCMQTTResponse) => {
                clearTimeout(timeout);
                resolve(message);
              };
              responseEmitter.once(correlationId, onMessage);
              if (protocolVersion >= 5) {
                // MQTT 5.0+, use the correlationData & responseTopic field
                const opts = {
                  properties: {
                    responseTopic,
                    correlationData: Buffer.from(correlationId)
                  }
                };
                client.publish(requestTopic, JSON.stringify(message), opts);
              } else {
                // MQTT < 5.0, use the message itself
                client.publish(
                  requestTopic,
                  JSON.stringify({ ...message, correlationId, responseTopic })
                );
              }
            });

          request(
            {
              trpc: {
                id,
                method: type,
                params: { path, input }
              }
            },
            abortController.signal
          )
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

        return () => {
          // This runs after every procedure call, whether it was successful, unsuccessful, or externally aborted
          abortController.abort();
        };
      });
    };
  };
};
