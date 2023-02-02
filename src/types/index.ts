import type {
  TRPCClientOutgoingMessage,
  TRPCErrorResponse,
  TRPCRequest,
  TRPCResultMessage
} from '@trpc/server/rpc';

export type TRPCMQTTRequest = {
  trpc: TRPCRequest | TRPCClientOutgoingMessage;
};

export type TRPCMQTTSuccessResponse = {
  trpc: TRPCResultMessage<any>;
};

export type TRPCMQTTErrorResponse = {
  trpc: TRPCErrorResponse;
};

export type TRPCMQTTResponse = TRPCMQTTSuccessResponse | TRPCMQTTErrorResponse;
