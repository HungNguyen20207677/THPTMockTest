import { z } from "zod";

import { ApiClientError, apiRequest } from "@/lib/api/client";
import { EXAM_PDF_MAX_BYTES } from "@/lib/constants/exam";
import type {
  DeleteExamInput,
  CreateExamInput,
  UpdateExamStatusInput,
  UpdateExamInput,
} from "@/lib/validations/exam";
import { getExamPdfValidationError } from "@/lib/validations/exam-pdf";
import type { ApiSuccessResponse } from "@/types/api";
import type { HardDeleteResult } from "@/types/deletion";
import type { BulkDeletionResult } from "@/types/bulk-deletion";
import type {
  ExamDetail,
  ExamPdfUploadReference,
  ExamPdfUploadTicket,
  ExamSummary,
  SolutionPdfUploadTicket,
} from "@/types/exam";

const EXAMS_ENDPOINT = "/api/admin/exams";
const PDF_ENDPOINT = `${EXAMS_ENDPOINT}/pdf`;
const PDF_SIGNATURE_ENDPOINT = `${PDF_ENDPOINT}/signature`;
const SOLUTION_PDF_ENDPOINT = `${EXAMS_ENDPOINT}/solution-pdf`;
const SOLUTION_PDF_SIGNATURE_ENDPOINT = `${SOLUTION_PDF_ENDPOINT}/signature`;

const cloudinaryPdfUploadResponseSchema = z.object({
  public_id: z.string(),
  resource_type: z.literal("raw"),
  type: z.enum(["upload", "authenticated"]),
  bytes: z.number().int().positive().max(EXAM_PDF_MAX_BYTES),
  secure_url: z.url().refine((url) => url.startsWith("https://")),
  placeholder: z.boolean().optional(),
});

const cloudinaryErrorResponseSchema = z.object({
  error: z.object({ message: z.string() }),
});

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    const body = await response.text();
    return body ? JSON.parse(body) : null;
  } catch {
    return null;
  }
}

function getCloudinaryUploadErrorMessage(
  status: number,
  payload: unknown,
): string {
  const parsedError = cloudinaryErrorResponseSchema.safeParse(payload);
  const cloudinaryMessage = parsedError.success
    ? parsedError.data.error.message.toLowerCase()
    : "";

  if (
    status === 413 ||
    /file size|too large|maximum file/i.test(cloudinaryMessage)
  ) {
    return "Tệp PDF không được vượt quá 15 MB.";
  }

  if (
    status === 420 ||
    status === 429 ||
    /rate limit/i.test(cloudinaryMessage)
  ) {
    return "Dịch vụ tải PDF đang quá tải. Vui lòng thử lại sau.";
  }

  if (/invalid signature|timestamp/i.test(cloudinaryMessage)) {
    return "Phiên tải PDF không hợp lệ hoặc đã hết hạn. Vui lòng thử lưu lại.";
  }

  if (/api key|cloud name/i.test(cloudinaryMessage)) {
    return "Dịch vụ tải PDF chưa được cấu hình đúng. Vui lòng liên hệ quản trị hệ thống.";
  }

  if (/format|pdf|file type/i.test(cloudinaryMessage)) {
    return "Cloudinary không chấp nhận định dạng của tệp PDF này.";
  }

  return "Cloudinary không chấp nhận tệp PDF này.";
}

async function discardUploadedExamPdf(
  reference: ExamPdfUploadReference,
  isSolution = false,
): Promise<void> {
  try {
    await apiRequest<void>(
      isSolution ? SOLUTION_PDF_ENDPOINT : PDF_ENDPOINT,
      jsonRequest("DELETE", reference),
    );
  } catch {
    // A cleanup failure must not hide the original upload or save error.
  }
}

async function uploadExamPdfDirectly(
  file: File,
  isSolution = false,
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
    ApiSuccessResponse<{
      upload: ExamPdfUploadTicket | SolutionPdfUploadTicket;
    }>
  >(
    isSolution ? SOLUTION_PDF_SIGNATURE_ENDPOINT : PDF_SIGNATURE_ENDPOINT,
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
    await discardUploadedExamPdf(reference, isSolution);

    throw new ApiClientError(
      "Không thể tải tệp PDF lên Cloudinary. Vui lòng thử lại.",
      502,
      "PDF_UPLOAD_FAILED",
    );
  }

  const responsePayload = await readJsonResponse(response);

  if (!response.ok) {
    await discardUploadedExamPdf(reference, isSolution);

    throw new ApiClientError(
      getCloudinaryUploadErrorMessage(response.status, responsePayload),
      response.status,
      "PDF_UPLOAD_FAILED",
    );
  }

  const parsedUpload =
    cloudinaryPdfUploadResponseSchema.safeParse(responsePayload);

  if (
    !parsedUpload.success ||
    parsedUpload.data.public_id !== reference.publicId ||
    parsedUpload.data.bytes !== file.size ||
    parsedUpload.data.type !== (isSolution ? "authenticated" : "upload") ||
    parsedUpload.data.placeholder === true
  ) {
    await discardUploadedExamPdf(reference, isSolution);

    throw new ApiClientError(
      "Cloudinary trả về thông tin tệp PDF không hợp lệ.",
      502,
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
  input: CreateExamInput,
  pdf: File,
  solutionPdf?: File,
): Promise<ApiSuccessResponse<{ exam: ExamDetail }>> {
  const pdfUpload = await uploadExamPdfDirectly(pdf);
  let solutionPdfUpload: ExamPdfUploadReference | undefined;

  try {
    solutionPdfUpload = solutionPdf
      ? await uploadExamPdfDirectly(solutionPdf, true)
      : undefined;
  } catch (error) {
    await discardUploadedExamPdf(pdfUpload);
    throw error;
  }

  try {
    return await apiRequest(
      EXAMS_ENDPOINT,
      jsonRequest("POST", { exam: input, pdfUpload, solutionPdfUpload }),
    );
  } catch (error) {
    await discardUploadedExamPdf(pdfUpload);
    if (solutionPdfUpload) {
      await discardUploadedExamPdf(solutionPdfUpload, true);
    }

    throw error;
  }
}

export async function updateExamRecord(
  examId: string,
  input: UpdateExamInput,
  replacementPdf?: File,
  confirmAnswerKeyCorrection = false,
  replacementSolutionPdf?: File,
  removeSolutionPdf = false,
): Promise<ApiSuccessResponse<{ exam: ExamDetail }>> {
  const replacementPdfUpload = replacementPdf
    ? await uploadExamPdfDirectly(replacementPdf)
    : undefined;
  const replacementSolutionPdfUpload = replacementSolutionPdf
    ? await uploadExamPdfDirectly(replacementSolutionPdf, true)
    : undefined;

  try {
    return await apiRequest(
      `${EXAMS_ENDPOINT}/${examId}`,
      jsonRequest("PATCH", {
        exam: input,
        replacementPdfUpload,
        replacementSolutionPdfUpload,
        removeSolutionPdf: removeSolutionPdf || undefined,
        confirmAnswerKeyCorrection: confirmAnswerKeyCorrection || undefined,
      }),
    );
  } catch (error) {
    if (replacementPdfUpload) {
      await discardUploadedExamPdf(replacementPdfUpload);
    }
    if (replacementSolutionPdfUpload) {
      await discardUploadedExamPdf(replacementSolutionPdfUpload, true);
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
): Promise<ApiSuccessResponse<HardDeleteResult>> {
  return apiRequest(
    `${EXAMS_ENDPOINT}/${examId}`,
    jsonRequest("DELETE", input),
  );
}

export function bulkDeleteExamRecords(
  items: Array<{ id: string; expectedUpdatedAt: string }>,
): Promise<ApiSuccessResponse<BulkDeletionResult>> {
  return apiRequest(
    `${EXAMS_ENDPOINT}/bulk-delete`,
    jsonRequest("POST", { items }),
  );
}
