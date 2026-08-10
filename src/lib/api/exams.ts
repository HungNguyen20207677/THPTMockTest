import { ApiClientError, apiRequest } from "@/lib/api/client";
import { EXAM_PDF_MAX_BYTES } from "@/lib/constants/exam";
import type {
  DeleteExamInput,
  UpdateExamStatusInput,
  UpdateExamInput,
  UpsertExamInput,
} from "@/lib/validations/exam";
import { getExamPdfValidationError } from "@/lib/validations/exam-pdf";
import type { ApiSuccessResponse } from "@/types/api";
import type {
  ExamDetail,
  ExamPdfUploadReference,
  ExamPdfUploadTicket,
  ExamSummary,
} from "@/types/exam";

const EXAMS_ENDPOINT = "/api/admin/exams";
const PDF_ENDPOINT = `${EXAMS_ENDPOINT}/pdf`;
const PDF_SIGNATURE_ENDPOINT = `${PDF_ENDPOINT}/signature`;

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function discardUploadedExamPdf(
  reference: ExamPdfUploadReference,
): Promise<void> {
  try {
    await apiRequest<void>(PDF_ENDPOINT, jsonRequest("DELETE", reference));
  } catch {
    // A cleanup failure must not hide the original upload or save error.
  }
}

async function uploadExamPdfDirectly(
  file: File,
): Promise<ExamPdfUploadReference> {
  const validationError = getExamPdfValidationError(file);

  if (validationError) {
    throw new ApiClientError(
      validationError,
      file.size > EXAM_PDF_MAX_BYTES ? 413 : 400,
      file.size > EXAM_PDF_MAX_BYTES ? "PDF_TOO_LARGE" : "INVALID_EXAM_PDF",
    );
  }

  const ticketResponse = await apiRequest<
    ApiSuccessResponse<{ upload: ExamPdfUploadTicket }>
  >(
    PDF_SIGNATURE_ENDPOINT,
    jsonRequest("POST", {
      name: file.name,
      type: file.type,
      size: file.size,
    }),
  );
  const ticket = ticketResponse.data.upload;
  const uploadBody = new FormData();
  uploadBody.set("file", file, file.name);
  uploadBody.set("api_key", ticket.apiKey);
  uploadBody.set("signature", ticket.signature);

  for (const [name, value] of Object.entries(ticket.fields)) {
    uploadBody.set(name, value);
  }

  const reference: ExamPdfUploadReference = {
    publicId: ticket.fields.public_id,
    originalFilename: ticket.fields.filename_override,
    timestamp: Number(ticket.fields.timestamp),
    signature: ticket.signature,
  };

  let response: Response;

  try {
    response = await fetch(ticket.uploadUrl, {
      method: "POST",
      body: uploadBody,
    });
  } catch {
    await discardUploadedExamPdf(reference);

    throw new ApiClientError(
      "Không thể tải tệp PDF lên Cloudinary. Vui lòng thử lại.",
      502,
      "PDF_UPLOAD_FAILED",
    );
  }

  if (!response.ok) {
    await discardUploadedExamPdf(reference);

    throw new ApiClientError(
      "Cloudinary không chấp nhận tệp PDF này.",
      response.status,
      "PDF_UPLOAD_FAILED",
    );
  }

  return reference;
}

export function fetchExams(): Promise<
  ApiSuccessResponse<{ exams: ExamSummary[] }>
> {
  return apiRequest(EXAMS_ENDPOINT);
}

export function fetchExam(
  examId: string,
): Promise<ApiSuccessResponse<{ exam: ExamDetail }>> {
  return apiRequest(`${EXAMS_ENDPOINT}/${examId}`);
}

export async function createExamRecord(
  input: UpsertExamInput,
  pdf: File,
): Promise<ApiSuccessResponse<{ exam: ExamDetail }>> {
  const pdfUpload = await uploadExamPdfDirectly(pdf);

  try {
    return await apiRequest(
      EXAMS_ENDPOINT,
      jsonRequest("POST", { exam: input, pdfUpload }),
    );
  } catch (error) {
    await discardUploadedExamPdf(pdfUpload);

    throw error;
  }
}

export async function updateExamRecord(
  examId: string,
  input: UpdateExamInput,
  replacementPdf?: File,
): Promise<ApiSuccessResponse<{ exam: ExamDetail }>> {
  const replacementPdfUpload = replacementPdf
    ? await uploadExamPdfDirectly(replacementPdf)
    : undefined;

  try {
    return await apiRequest(
      `${EXAMS_ENDPOINT}/${examId}`,
      jsonRequest("PATCH", { exam: input, replacementPdfUpload }),
    );
  } catch (error) {
    if (replacementPdfUpload) {
      await discardUploadedExamPdf(replacementPdfUpload);
    }

    throw error;
  }
}

export function updateExamRecordStatus(
  examId: string,
  input: UpdateExamStatusInput,
): Promise<ApiSuccessResponse<{ exam: ExamDetail }>> {
  return apiRequest(
    `${EXAMS_ENDPOINT}/${examId}/status`,
    jsonRequest("PATCH", input),
  );
}

export function deleteExamRecord(
  examId: string,
  input: DeleteExamInput,
): Promise<void> {
  return apiRequest(
    `${EXAMS_ENDPOINT}/${examId}`,
    jsonRequest("DELETE", input),
  );
}
