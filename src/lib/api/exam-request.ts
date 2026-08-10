import "server-only";

import { type output, type ZodType } from "zod";

import { EXAM_PDF_MAX_BYTES } from "@/lib/constants/exam";
import {
  ExamPdfTooLargeError,
  RequestValidationError,
} from "@/lib/errors/app-error";

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

interface ParsedExamMultipart<TInput> {
  input: TInput;
  pdf?: File;
}

interface ParsedExamMultipartWithPdf<TInput> {
  input: TInput;
  pdf: File;
}

export function parseExamMultipartRequest<TSchema extends ZodType>(
  request: Request,
  schema: TSchema,
  requirePdf: true,
): Promise<ParsedExamMultipartWithPdf<output<TSchema>>>;
export function parseExamMultipartRequest<TSchema extends ZodType>(
  request: Request,
  schema: TSchema,
  requirePdf: false,
): Promise<ParsedExamMultipart<output<TSchema>>>;
export async function parseExamMultipartRequest<TSchema extends ZodType>(
  request: Request,
  schema: TSchema,
  requirePdf: boolean,
): Promise<ParsedExamMultipart<output<TSchema>>> {
  const contentLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(contentLength) &&
    contentLength > EXAM_PDF_MAX_BYTES + MULTIPART_OVERHEAD_BYTES
  ) {
    throw new ExamPdfTooLargeError();
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    throw new RequestValidationError("Dữ liệu biểu mẫu không hợp lệ.");
  }

  const payloadParts = formData.getAll("payload");

  if (payloadParts.length !== 1 || typeof payloadParts[0] !== "string") {
    throw new RequestValidationError("Thiếu dữ liệu đề thi.");
  }

  let payload: unknown;

  try {
    payload = JSON.parse(payloadParts[0]);
  } catch {
    throw new RequestValidationError("Dữ liệu đề thi không phải JSON hợp lệ.");
  }

  const parsedInput = schema.safeParse(payload);

  if (!parsedInput.success) {
    throw new RequestValidationError(
      parsedInput.error.issues[0]?.message ?? "Dữ liệu đề thi không hợp lệ.",
    );
  }

  const pdfParts = formData.getAll("pdf");

  if (pdfParts.length > 1 || typeof pdfParts[0] === "string") {
    throw new RequestValidationError("Tệp PDF gửi lên không hợp lệ.");
  }

  const pdf = pdfParts[0] instanceof File ? pdfParts[0] : undefined;

  if (requirePdf && !pdf) {
    throw new RequestValidationError("Vui lòng chọn tệp PDF của đề thi.");
  }

  return { input: parsedInput.data, pdf };
}
