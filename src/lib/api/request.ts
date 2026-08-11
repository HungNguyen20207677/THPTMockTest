import "server-only";

import { type output, type ZodType } from "zod";

import {
  RequestTooLargeError,
  RequestValidationError,
  UnsupportedMediaTypeError,
} from "@/lib/errors/app-error";

const MAX_JSON_BODY_BYTES = 256 * 1024;

async function readBoundedJsonBody(request: Request): Promise<unknown> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (mediaType !== "application/json") {
    throw new UnsupportedMediaTypeError();
  }

  const declaredLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new RequestTooLargeError();
  }

  if (!request.body) {
    throw new RequestValidationError("Nội dung JSON không hợp lệ.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > MAX_JSON_BODY_BYTES) {
      await reader.cancel();
      throw new RequestTooLargeError();
    }

    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw new RequestValidationError("Nội dung JSON không hợp lệ.");
  }
}

export async function parseJsonRequest<TSchema extends ZodType>(
  request: Request,
  schema: TSchema,
): Promise<output<TSchema>> {
  const body = await readBoundedJsonBody(request);

  const result = schema.safeParse(body);

  if (!result.success) {
    throw new RequestValidationError(
      result.error.issues[0]?.message ?? "Dữ liệu gửi lên không hợp lệ.",
    );
  }

  return result.data;
}
