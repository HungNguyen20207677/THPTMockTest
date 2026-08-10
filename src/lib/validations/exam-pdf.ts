import { z } from "zod";

import { EXAM_PDF_MAX_BYTES, EXAM_PDF_MIME_TYPE } from "@/lib/constants/exam";

export interface PdfFileMetadata {
  name: string;
  type: string;
  size: number;
}

export function getExamPdfValidationError(
  file: PdfFileMetadata,
): string | null {
  if (file.name.length > 255) {
    return "Tên tệp PDF không được vượt quá 255 ký tự.";
  }

  if (/[\u0000-\u001f\u007f/\\]/.test(file.name)) {
    return "Tên tệp PDF chứa ký tự không hợp lệ.";
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return "Tệp đề thi phải có phần mở rộng .pdf.";
  }

  if (file.type !== EXAM_PDF_MIME_TYPE) {
    return "Tệp đề thi phải có định dạng PDF.";
  }

  if (file.size <= 0) {
    return "Tệp PDF không được để trống.";
  }

  if (file.size > EXAM_PDF_MAX_BYTES) {
    return "Tệp PDF không được vượt quá 15 MB.";
  }

  return null;
}

export const examPdfUploadIntentSchema = z.strictObject({
  name: z.string(),
  type: z.string(),
  size: z.number().int(),
});

export const examPdfUploadReferenceSchema = z.strictObject({
  publicId: z.string().trim().min(1).max(255),
  originalFilename: z.string().trim().min(1).max(255),
  timestamp: z.number().int().positive(),
  signature: z.string().regex(/^[a-f\d]{40,64}$/i),
});

export type ExamPdfUploadIntent = z.infer<typeof examPdfUploadIntentSchema>;
