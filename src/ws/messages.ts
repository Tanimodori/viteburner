import { z } from 'zod';

export interface WsRequestNoParam {
  jsonrpc: '2.0';
  id: number;
  method: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface WsRequest<P = any> extends WsRequestNoParam {
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
export const pushFileResponseSchema = z.literal('OK');

// getFile
export interface GetFileParams {
  filename: string;
  server: string;
}
export const getFileResponseSchema = z.string();

// deleteFile
export interface DeleteFileParams {
  filename: string;
  server: string;
}
export const deleteFileResponseSchema = z.literal('OK');

// getFileNames
export interface GetFileNamesParams {
  server: string;
}
export const getFileNamesResponseSchema = z.array(z.string());

// getAllFiles
export interface GetAllFilesParams {
  server: string;
}
export const getAllFilesResponseSchema = z.array(
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
export const calculateRamResponseSchema = z.number();

// getDefinitionFile
// no params
export const getDefinitionFileResponseSchema = z.string();
