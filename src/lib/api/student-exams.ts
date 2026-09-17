import { ApiClientError, apiRequest } from "@/lib/api/client";
import { ESSAY_IMAGE_MAX_BYTES } from "@/lib/constants/exam-attempt";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import { isDynamicAttemptAnswers } from "@/lib/validations/attempt-answers";
import { getEssayImageValidationError } from "@/lib/validations/essay-image";
import type { ApiSuccessResponse } from "@/types/api";
import type {
  ExamAttemptAnswers,
  EssayImageUploadReference,
  EssayImageUploadTicket,
  StudentExamAttemptContext,
  StudentExamAttemptResult,
  StudentExamList,
  StudentExamAttemptMutationResult,
} from "@/types/exam-attempt";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";
import type { StudentExamAttemptHistory } from "@/types/reporting";

const STUDENT_EXAMS_ENDPOINT = "/api/student/exams";

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function fetchStudentExams(): Promise<
  ApiSuccessResponse<StudentExamList>
> {
  return apiRequest(STUDENT_EXAMS_ENDPOINT);
}

export function startStudentExamAttempt(
  examId: string,
  resumeAttemptId?: string,
): Promise<ApiSuccessResponse<{ context: StudentExamAttemptContext }>> {
  return apiRequest(
    `${STUDENT_EXAMS_ENDPOINT}/${examId}/attempts`,
    jsonRequest("POST", { resumeAttemptId }),
  );
}

export function fetchStudentExamAttempt(
  examId: string,
  attemptId: string,
): Promise<ApiSuccessResponse<{ context: StudentExamAttemptContext }>> {
  return apiRequest(
    `${STUDENT_EXAMS_ENDPOINT}/${examId}/attempts/${attemptId}`,
  );
}

function getAttemptEndpoint(examId: string, attemptId: string): string {
  return `${STUDENT_EXAMS_ENDPOINT}/${examId}/attempts/${attemptId}`;
}

function getEssayImageEndpoint(
  examId: string,
  attemptId: string,
  questionId: string,
): string {
  return `${getAttemptEndpoint(encodeURIComponent(examId), encodeURIComponent(attemptId))}/answers/${encodeURIComponent(questionId)}/images`;
}

export function getObjectiveAutosaveAnswers(
  answers: ExamAttemptAnswers,
  structure?: ExamStructureSnapshot,
): ExamAttemptAnswers {
  if (!structure || !isDynamicAttemptAnswers(answers)) {
    return answers;
  }

  const essayQuestionIds = new Set(
    structure.sections.flatMap((section) =>
      section.questions
        .filter(
          (question) =>
            question.type === EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
        )
        .map((question) => question.id),
    ),
  );

  return {
    answersByQuestionId: Object.fromEntries(
      Object.entries(answers.answersByQuestionId).filter(
        ([questionId]) => !essayQuestionIds.has(questionId),
      ),
    ),
  };
}

export function saveStudentExamAttemptAnswers(
  examId: string,
  attemptId: string,
  answers: ExamAttemptAnswers,
  answerRevision: number,
  structure?: ExamStructureSnapshot,
): Promise<ApiSuccessResponse<StudentExamAttemptMutationResult>> {
  return apiRequest(
    `${getAttemptEndpoint(examId, attemptId)}/answers`,
    jsonRequest("PATCH", {
      answers: getObjectiveAutosaveAnswers(answers, structure),
      answerRevision,
    }),
  );
}

export async function uploadStudentEssayImage(
  examId: string,
  attemptId: string,
  questionId: string,
  file: File,
): Promise<ApiSuccessResponse<StudentExamAttemptMutationResult>> {
  const validationError = getEssayImageValidationError(file);

  if (validationError) {
    throw new ApiClientError(
      validationError,
      file.size > ESSAY_IMAGE_MAX_BYTES ? 413 : 400,
      file.size > ESSAY_IMAGE_MAX_BYTES
        ? "ESSAY_IMAGE_TOO_LARGE"
        : "INVALID_ESSAY_IMAGE",
    );
  }

  const endpoint = getEssayImageEndpoint(examId, attemptId, questionId);
  const ticketResponse = await apiRequest<
    ApiSuccessResponse<{ upload: EssayImageUploadTicket }>
  >(
    `${endpoint}/signature`,
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

  let uploadResponse: Response;

  try {
    uploadResponse = await fetch(ticket.uploadUrl, {
      method: "POST",
      body: uploadBody,
    });
  } catch {
    throw new ApiClientError(
      "Không thể tải ảnh lên Cloudinary. Vui lòng thử lại.",
      502,
      "ESSAY_IMAGE_UPLOAD_FAILED",
    );
  }

  if (!uploadResponse.ok) {
    throw new ApiClientError(
      "Cloudinary không chấp nhận ảnh này.",
      uploadResponse.status,
      "ESSAY_IMAGE_UPLOAD_FAILED",
    );
  }

  const reference: EssayImageUploadReference = {
    publicId: ticket.fields.public_id,
    originalFilename: ticket.fields.filename_override,
    timestamp: Number(ticket.fields.timestamp),
    signature: ticket.signature,
  };

  return apiRequest(endpoint, jsonRequest("POST", { upload: reference }));
}

export function removeStudentEssayImage(
  examId: string,
  attemptId: string,
  questionId: string,
  publicId: string,
): Promise<ApiSuccessResponse<StudentExamAttemptMutationResult>> {
  return apiRequest(
    getEssayImageEndpoint(examId, attemptId, questionId),
    jsonRequest("DELETE", { publicId }),
  );
}

export function submitStudentExamAttempt(
  examId: string,
  attemptId: string,
  answers: ExamAttemptAnswers,
  answerRevision: number,
): Promise<ApiSuccessResponse<StudentExamAttemptMutationResult>> {
  return apiRequest(
    `${getAttemptEndpoint(examId, attemptId)}/submit`,
    jsonRequest("POST", { answers, answerRevision }),
  );
}

export function finalizeStudentExamAttempt(
  examId: string,
  attemptId: string,
): Promise<ApiSuccessResponse<StudentExamAttemptMutationResult>> {
  return apiRequest(
    `${getAttemptEndpoint(examId, attemptId)}/auto-submit`,
    jsonRequest("POST", {}),
  );
}

export function fetchStudentExamAttemptResult(
  examId: string,
  attemptId: string,
): Promise<ApiSuccessResponse<{ result: StudentExamAttemptResult }>> {
  return apiRequest(`${getAttemptEndpoint(examId, attemptId)}/result`);
}

export function fetchStudentExamAttemptHistory(
  examId: string,
  page = 1,
  pageSize = 20,
): Promise<ApiSuccessResponse<{ history: StudentExamAttemptHistory }>> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  return apiRequest(
    `${STUDENT_EXAMS_ENDPOINT}/${examId}/history?${searchParams.toString()}`,
  );
}
