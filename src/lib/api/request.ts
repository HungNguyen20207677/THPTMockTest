import "server-only";

import { type output, type ZodType } from "zod";

import { RequestValidationError } from "@/lib/errors/app-error";

export async function parseJsonRequest<TSchema extends ZodType>(
  request: Request,
  schema: TSchema,
): Promise<output<TSchema>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new RequestValidationError("Nội dung JSON không hợp lệ.");
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    throw new RequestValidationError(
      result.error.issues[0]?.message ?? "Dữ liệu gửi lên không hợp lệ.",
    );
  }

  return result.data;
}
