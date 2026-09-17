import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getObjectiveAutosaveAnswers,
  removeStudentEssayImage,
  saveStudentExamAttemptAnswers,
  submitStudentExamAttempt,
  uploadStudentEssayImage,
} from "@/lib/api/student-exams";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import type { EssayImage, EssayImageUploadTicket } from "@/types/exam-attempt";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";

const fetchMock = vi.fn();
const questionId = "essay/question";
const publicId = "thpt-mock-test/essay-images/scope/image-id";
const signature = "a".repeat(40);
const ticket: EssayImageUploadTicket = {
  uploadUrl: "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
  apiKey: "test-api-key",
  signature,
  fields: {
    timestamp: "1786363200",
    public_id: publicId,
    overwrite: "0",
    allowed_formats: "jpg,jpeg,png,webp",
    filename_override: "answer.jpg",
    type: "upload",
  },
};
const image: EssayImage = {
  publicId,
  secureUrl:
    "https://res.cloudinary.com/test-cloud/image/upload/v1/scope/image-id.jpg",
  originalFilename: "answer.jpg",
  bytes: 1024,
  format: "jpg",
  width: 1200,
  height: 800,
};
const structure: ExamStructureSnapshot = {
  sections: [
    {
      id: "mixed",
      title: "Mixed",
      questions: [
        {
          id: "choice",
          type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
          maxScoreHundredths: 500,
        },
        {
          id: questionId,
          type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          maxScoreHundredths: 500,
        },
      ],
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("student essay image API client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads directly to Cloudinary and attaches the signed resource", async () => {
    const mutation = {
      data: {
        attempt: {
          answers: {
            answersByQuestionId: {
              choice: null,
              [questionId]: { type: "ESSAY_IMAGE", images: [image] },
            },
          },
        },
      },
    };
    const file = new File(["jpeg"], "answer.jpg", { type: "image/jpeg" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { upload: ticket } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse(mutation));

    await expect(
      uploadStudentEssayImage("exam-id", "attempt-id", questionId, file),
    ).resolves.toEqual(mutation);

    const imageEndpoint =
      "/api/student/exams/exam-id/attempts/attempt-id/answers/essay%2Fquestion/images";
    expect(fetchMock.mock.calls[0][0]).toBe(`${imageEndpoint}/signature`);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    expect(fetchMock.mock.calls[1][0]).toBe(ticket.uploadUrl);
    const cloudinaryBody = fetchMock.mock.calls[1][1].body as FormData;
    expect(cloudinaryBody.get("file")).toMatchObject({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    expect(cloudinaryBody.get("api_key")).toBe(ticket.apiKey);
    for (const [name, value] of Object.entries(ticket.fields)) {
      expect(cloudinaryBody.get(name)).toBe(value);
    }

    expect(fetchMock.mock.calls[2][0]).toBe(imageEndpoint);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string)).toEqual({
      upload: {
        publicId,
        originalFilename: "answer.jpg",
        timestamp: 1_786_363_200,
        signature,
      },
    });
  });

  it("does not attach when a direct upload fails", async () => {
    const file = new File(["jpeg"], "answer.jpg", { type: "image/jpeg" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { upload: ticket } }))
      .mockResolvedValueOnce(new Response(null, { status: 400 }));

    await expect(
      uploadStudentEssayImage("exam-id", "attempt-id", questionId, file),
    ).rejects.toMatchObject({ code: "ESSAY_IMAGE_UPLOAD_FAILED" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("removes an image only through the dedicated mutation endpoint", async () => {
    const response = { data: { attempt: { id: "attempt-id" } } };
    fetchMock.mockResolvedValueOnce(jsonResponse(response));

    await expect(
      removeStudentEssayImage("exam-id", "attempt-id", questionId, publicId),
    ).resolves.toEqual(response);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/student/exams/exam-id/attempts/attempt-id/answers/essay%2Fquestion/images",
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      publicId,
    });
  });

  it("excludes ESSAY_IMAGE answers from objective autosave payloads", async () => {
    const answers = {
      answersByQuestionId: {
        choice: "A" as const,
        [questionId]: { type: "ESSAY_IMAGE" as const, images: [image] },
      },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: {} }));

    expect(getObjectiveAutosaveAnswers(answers, structure)).toEqual({
      answersByQuestionId: { choice: "A" },
    });
    await saveStudentExamAttemptAnswers(
      "exam-id",
      "attempt-id",
      answers,
      6,
      structure,
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      answers: { answersByQuestionId: { choice: "A" } },
      answerRevision: 6,
    });
  });

  it("submits the full current answer representation with its revision", async () => {
    const answers = {
      answersByQuestionId: {
        choice: "A" as const,
        [questionId]: { type: "ESSAY_IMAGE" as const, images: [image] },
      },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: {} }));

    await submitStudentExamAttempt("exam-id", "attempt-id", answers, 7);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      answers,
      answerRevision: 7,
    });
  });
});
