/**
 * NDJSON streaming utilities for long-running AI operations.
 *
 * Used by GateKeeper for website crawl + analysis progress streaming.
 * Any product can use this for operations that take 10+ seconds and
 * need to report progress to the client.
 *
 * Server: createNDJSONStream() → write progress events → close()
 * Client: parseNDJSONStream() → async iterate over events
 */

import type { NDJSONWriter } from './types'

/**
 * Create a server-side NDJSON stream.
 * Returns a ReadableStream (pass to Response) and a writer for emitting events.
 */
export function createNDJSONStream<T = unknown>(): {
  stream: ReadableStream
  writer: NDJSONWriter<T>
} {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController | null = null

  const stream = new ReadableStream({
    start(c) {
      controller = c
    },
  })

  const writer: NDJSONWriter<T> = {
    write(data: T) {
      if (controller) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
      }
    },
    close() {
      if (controller) {
        controller.close()
        controller = null
      }
    },
  }

  return { stream, writer }
}

/**
 * Parse a client-side NDJSON stream into an async iterable.
 * Use with fetch() response body for consuming streamed events.
 */
export async function* parseNDJSONStream<T = unknown>(
  stream: ReadableStream
): AsyncIterable<T> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed) {
          try {
            yield JSON.parse(trimmed) as T
          } catch {
            // Skip malformed lines
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer.trim()) as T
      } catch {
        // Skip malformed trailing data
      }
    }
  } finally {
    reader.releaseLock()
  }
}
