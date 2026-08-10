import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/errors/app-error";
import type { ApiErrorResponse } from "@/types/api";

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const response = {
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message ?? "Dữ liệu gửi lên không hợp lệ.",
      },
    } satisfies ApiErrorResponse;

    return NextResponse.json(response, { status: 400 });
  }

  if (error instanceof AppError) {
    const response = {
      error: {
        code: error.code,
        message: error.message,
      },
    } satisfies ApiErrorResponse;

    return NextResponse.json(response, { status: error.statusCode });
  }

  console.error(error);

  const response = {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Đã xảy ra lỗi không mong muốn.",
    },
  } satisfies ApiErrorResponse;

  return NextResponse.json(response, { status: 500 });
}
