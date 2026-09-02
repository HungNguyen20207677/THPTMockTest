import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createExamRecord, updateExamRecord } from "@/lib/api/exams";
import {
  EXAM_STATUS,
  EXAM_STRUCTURE,
  EXAM_VISIBILITY_MODE,
  PART3_INPUT_MODE,
} from "@/lib/constants/exam";
import { createEmptyQuestionTopicIds } from "@/lib/exam/question-topics";
import type { UpdateExamInput, UpsertExamInput } from "@/lib/validations/exam";
import type { ExamPdfUploadReference, ExamPdfUploadTicket } from "@/types/exam";

const fetchMock = vi.fn();
const publicId =
  "thpt-mock-test/exams/123e4567-e89b-42d3-a456-426614174000.pdf";
const signature = "a".repeat(40);
const ticket: ExamPdfUploadTicket = {
  uploadUrl: "https://api.cloudinary.com/v1_1/test-cloud/raw/upload",
  apiKey: "test-api-key",
  signature,
  fields: {
    timestamp: "1786363200",
    public_id: publicId,
    overwrite: "0",
    allowed_formats: "pdf",
    filename_override: "de-thi.pdf",
    type: "upload",
  },
};
const reference: ExamPdfUploadReference = {
  publicId,
  originalFilename: "de-thi.pdf",
  timestamp: 1_786_363_200,
  signature,
};

function createValidInput(): UpsertExamInput {
  return {
    title: "De thi thu Toan so 1",
    description: undefined,
    status: EXAM_STATUS.DRAFT,
    visibilityMode: EXAM_VISIBILITY_MODE.ALL_STUDENTS,
    assignedStudentIds: [],
    part3InputMode: PART3_INPUT_MODE.BUBBLE,
    settings: {
      allowRetake: true,
      showScoreAfterSubmission: true,
      showAnswersAfterSubmission: false,
    },
    questionTopicIds: createEmptyQuestionTopicIds(),
    answerKey: {
      partOne: Array.from(
        { length: EXAM_STRUCTURE.partOneQuestions },
        () => "A" as const,
      ),
      partTwo: Array.from({ length: EXAM_STRUCTURE.partTwoQuestions }, () => ({
        a: true,
        b: false,
        c: true,
        d: false,
      })),
      partThree: Array.from(
        { length: EXAM_STRUCTURE.partThreeQuestions },
        () => "0.5",
      ),
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Exam API client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads the PDF directly with exactly the signed fields, then finalizes JSON", async () => {
    const input = createValidInput();
    const file = new File(["%PDF-1.7"], " de-thi.pdf", {
      type: "application/pdf",
    });
    const result = { data: { exam: { id: "exam-id" } } };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { upload: ticket } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse(result));

    await expect(createExamRecord(input, file)).resolves.toEqual(result);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/exams/pdf/signature",
      expect.objectContaining({ method: "POST" }),
    );
    const signatureRequest = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(signatureRequest.body as string)).toEqual({
      name: " de-thi.pdf",
      type: "application/pdf",
      size: file.size,
    });

    expect(fetchMock.mock.calls[1][0]).toBe(ticket.uploadUrl);
    const uploadRequest = fetchMock.mock.calls[1][1] as RequestInit;
    const uploadBody = uploadRequest.body as FormData;
    expect(uploadRequest.method).toBe("POST");
    expect(Array.from(uploadBody.keys()).sort()).toEqual(
      [
        "allowed_formats",
        "api_key",
        "file",
        "filename_override",
        "overwrite",
        "public_id",
        "signature",
        "timestamp",
        "type",
      ].sort(),
    );
    expect(uploadBody.get("api_key")).toBe(ticket.apiKey);
    expect(uploadBody.get("signature")).toBe(ticket.signature);

    for (const [name, value] of Object.entries(ticket.fields)) {
      expect(uploadBody.get(name)).toBe(value);
    }

    expect(fetchMock.mock.calls[2][0]).toBe("/api/admin/exams");
    const finalizeRequest = fetchMock.mock.calls[2][1] as RequestInit;
    expect(finalizeRequest.method).toBe("POST");
    expect(JSON.parse(finalizeRequest.body as string)).toEqual({
      exam: input,
      pdfUpload: reference,
    });
  });

  it("discards an uploaded asset after a definitive finalization failure", async () => {
    const file = new File(["%PDF-1.7"], "de-thi.pdf", {
      type: "application/pdf",
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { upload: ticket } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "EXAM_CONFLICT",
              message: "Conflict",
            },
          },
          409,
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      createExamRecord(createValidInput(), file),
    ).rejects.toMatchObject({
      code: "EXAM_CONFLICT",
      statusCode: 409,
    });

    expect(fetchMock.mock.calls[3][0]).toBe("/api/admin/exams/pdf");
    const cleanupRequest = fetchMock.mock.calls[3][1] as RequestInit;
    expect(cleanupRequest.method).toBe("DELETE");
    expect(JSON.parse(cleanupRequest.body as string)).toEqual(reference);
  });

  it("attempts signed cleanup when the Cloudinary response is lost", async () => {
    const file = new File(["%PDF-1.7"], "de-thi.pdf", {
      type: "application/pdf",
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { upload: ticket } }))
      .mockRejectedValueOnce(new TypeError("Network connection lost"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      createExamRecord(createValidInput(), file),
    ).rejects.toMatchObject({
      code: "PDF_UPLOAD_FAILED",
      statusCode: 502,
    });

    expect(fetchMock.mock.calls[2][0]).toBe("/api/admin/exams/pdf");
    const cleanupRequest = fetchMock.mock.calls[2][1] as RequestInit;
    expect(cleanupRequest.method).toBe("DELETE");
    expect(JSON.parse(cleanupRequest.body as string)).toEqual(reference);
  });

  it("updates Exam metadata through JSON without uploading a replacement", async () => {
    const input: UpdateExamInput = {
      ...createValidInput(),
      expectedUpdatedAt: "2026-08-10T12:00:00.000Z",
    };
    const result = { data: { exam: { id: "exam-id" } } };
    fetchMock.mockResolvedValueOnce(jsonResponse(result));

    await expect(updateExamRecord("exam-id", input)).resolves.toEqual(result);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/exams/exam-id");
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.method).toBe("PATCH");
    expect(JSON.parse(request.body as string)).toEqual({ exam: input });
  });

  it("sends explicit answer-key correction confirmation", async () => {
    const input: UpdateExamInput = {
      ...createValidInput(),
      expectedUpdatedAt: "2026-08-10T12:00:00.000Z",
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { exam: { id: "exam-id" } } }),
    );

    await updateExamRecord("exam-id", input, undefined, true);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({
      exam: input,
      confirmAnswerKeyCorrection: true,
    });
  });
});
