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
