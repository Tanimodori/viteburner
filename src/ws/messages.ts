import { z } from 'zod';

export interface WsRequest<P> {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: P;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface WsResponse<R = any> {
  jsonrpc: '2.0';
  id: number;
  result: R;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any;
}
export const wsResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.number(),
  result: z.any(),
  error: z.any(),
});

// pushFile
export interface PushFileParams {
  filename: string;
  content: string;
  server: string;
}
export const PushFileResponseSchema = z.literal('OK');

// getFile
export interface GetFileParams {
  filename: string;
  server: string;
}
export const GetFileResponseSchema = z.string();

// deleteFile
export interface DeleteFileParams {
  filename: string;
  server: string;
}
export const DeleteFileResponseSchema = z.literal('OK');

// getFileNames
export interface GetFileNamesParams {
  server: string;
}
export const GetFileNamesResponseSchema = z.array(z.string());

// getAllFiles
export interface GetAllFilesParams {
  server: string;
}
export const GetAllFilesResponseSchema = z.array(
  z.object({
    filename: z.string(),
    content: z.string(),
  }),
);

// calculateRam
export interface CalculateRamParams {
  filename: string;
  server: string;
}
export const CalculateRamResponseSchema = z.number();

// getDefinitionFile
// no params
export const GetDefinitionFileResponseSchema = z.string();

export function parseResponse<R extends z.ZodTypeAny>(response: string, schema: R): z.infer<R> {
  const json = JSON.parse(response);
  const { result, error } = wsResponseSchema.parse(json);
  if (error) {
    throw new Error(error);
  }
  return schema.parse(result);
}
