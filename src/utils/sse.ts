import type { FastifyReply } from "fastify";

/**
 * Format data as Server-Sent Events format
 */
export function formatSSE(data: object, event?: string): string {
  let sse = "";

  if (event) {
    sse += `event: ${event}\n`;
  }

  sse += `data: ${JSON.stringify(data)}\n\n`;
  return sse;
}

/**
 * Send SSE chunk to client
 */
export function sendSSEChunk(
  res: FastifyReply,
  data: object,
  event?: string
): void {
  const sse = formatSSE(data, event);
  res.raw.write(sse);
  // Note: Data is written immediately. Some clients like Postman will buffer
  // the entire response until complete, but curl (with -N flag) and browsers
  // will receive chunks in real-time as they're sent.
}

/**
 * Send final SSE event and close connection
 */
export function sendSSEEnd(res: FastifyReply, data: object): void {
  sendSSEChunk(res, data, "done");
  res.raw.end();
}

/**
 * Send error as SSE event and close connection
 */
export function sendSSEError(
  res: FastifyReply,
  error: string,
  detail?: string
): void {
  sendSSEChunk(res, { error, detail }, "error");
  res.raw.end();
}

/**
 * Set SSE response headers
 */
export function setSSEHeaders(res: FastifyReply): void {
  res.header("Content-Type", "text/event-stream");
  res.header("Cache-Control", "no-cache");
  res.header("Connection", "keep-alive");
  res.header("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Send headers immediately to start the stream
  res.raw.flushHeaders();
}
