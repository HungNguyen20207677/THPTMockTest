import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/errors/app-error";
import type { ApiErrorResponse } from "@/types/api";

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const response = {
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message ?? "Dữ liệu gửi lên không hợp lệ.",
      },
    } satisfies ApiErrorResponse;

    return NextResponse.json(response, {
      status: 400,
      headers: PRIVATE_RESPONSE_HEADERS,
    });
  }

  if (error instanceof AppError) {
    const response = {
      error: {
        code: error.code,
        message: error.message,
      },
    } satisfies ApiErrorResponse;

    return NextResponse.json(response, {
      status: error.statusCode,
      headers: PRIVATE_RESPONSE_HEADERS,
    });
  }

  console.error("Unhandled API error.", {
    name: error instanceof Error ? error.name : "UnknownError",
  });

  const response = {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Đã xảy ra lỗi không mong muốn.",
    },
  } satisfies ApiErrorResponse;

  return NextResponse.json(response, {
    status: 500,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}
