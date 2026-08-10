import { describe, expect, it } from "vitest";

import { parseExamMultipartRequest } from "@/lib/api/exam-request";
import { EXAM_STATUS, EXAM_STRUCTURE } from "@/lib/constants/exam";
import { examUpsertSchema } from "@/lib/validations/exam";

function createValidPayload() {
  return {
    title: "Đề thi thử Toán số 1",
    status: EXAM_STATUS.DRAFT,
    settings: {
      allowRetake: true,
      showScoreAfterSubmission: true,
      showAnswersAfterSubmission: false,
    },
    answerKey: {
      partOne: Array.from(
        { length: EXAM_STRUCTURE.partOneQuestions },
        () => "A",
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

describe("exam multipart request parsing", () => {
  it("parses one JSON payload and one PDF file", async () => {
    const formData = new FormData();
    formData.set("payload", JSON.stringify(createValidPayload()));
    formData.set(
      "pdf",
      new File(["%PDF-1.7"], "exam.pdf", { type: "application/pdf" }),
    );
    const request = new Request("http://localhost/api/admin/exams", {
      method: "POST",
      body: formData,
    });

    const result = await parseExamMultipartRequest(
      request,
      examUpsertSchema,
      true,
    );

    expect(result.input.title).toBe("Đề thi thử Toán số 1");
    expect(result.pdf.name).toBe("exam.pdf");
  });

  it("rejects a create request without a PDF", async () => {
    const formData = new FormData();
    formData.set("payload", JSON.stringify(createValidPayload()));
    const request = new Request("http://localhost/api/admin/exams", {
      method: "POST",
      body: formData,
    });

    await expect(
      parseExamMultipartRequest(request, examUpsertSchema, true),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
  });
});
