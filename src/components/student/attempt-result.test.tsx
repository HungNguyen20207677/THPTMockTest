import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AnswerReview,
  PendingGradingSummary,
  ScoreSummary,
} from "@/components/student/attempt-result";
import {
  EXAM_ATTEMPT_GRADING_STATUS,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import type { StudentExamAttemptResult } from "@/types/exam-attempt";

const pendingResult: StudentExamAttemptResult = {
  exam: {
    id: "essay-exam",
    title: "Essay Exam",
    structureSnapshot: {
      sections: [
        {
          id: "mixed",
          title: "Phần hỗn hợp",
          questions: [
            {
              id: "essay",
              type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
              maxScoreHundredths: 500,
            },
            {
              id: "choice",
              type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
              maxScoreHundredths: 500,
            },
          ],
        },
      ],
    },
  },
  attempt: {
    id: "attempt-id",
    attemptNumber: 1,
    status: EXAM_ATTEMPT_STATUS.SUBMITTED,
    startedAt: "2026-08-11T01:00:00.000Z",
    expiresAt: "2026-08-11T02:30:00.000Z",
    submittedAt: "2026-08-11T02:00:00.000Z",
    timeUsedSeconds: 3600,
  },
  visibility: { score: true, answers: true },
  gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
  objectiveScore: { earned: 5, maximum: 5 },
  dynamicAnswerReview: {
    questionsById: {
      essay: {
        type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
        studentAnswer: {
          type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          images: [
            {
              publicId: "essay-image",
              secureUrl:
                "https://res.cloudinary.com/test/image/upload/v1/essay-image.jpg",
              originalFilename: "essay-answer.jpg",
              bytes: 1024,
              format: "jpg",
              width: 1200,
              height: 800,
            },
          ],
        },
      },
      choice: {
        type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
        studentAnswer: "A",
        correctAnswer: "A",
        isCorrect: true,
      },
    },
  },
};

describe("pending ESSAY_IMAGE result", () => {
  it("shows pending objective grading without rendering a final score", () => {
    const markup = renderToStaticMarkup(
      <>
        <ScoreSummary result={pendingResult} />
        <PendingGradingSummary result={pendingResult} />
      </>,
    );

    expect(markup).toContain("Bài tự luận đang chờ chấm");
    expect(markup).toContain("Điểm phần đã chấm tự động");
    expect(markup).toContain("5,00 / 5,00");
    expect(markup).not.toContain("Tổng điểm");
  });

  it("renders submitted essay images read-only in answer review", () => {
    const markup = renderToStaticMarkup(
      <AnswerReview result={pendingResult} />,
    );

    expect(markup).toContain("Bài tự luận chưa được chấm");
    expect(markup).toContain("Ảnh bài làm 1");
    expect(markup).toContain("essay-answer.jpg");
    expect(markup).not.toContain("Tải ảnh bài làm");
    expect(markup).not.toContain("Xóa ảnh");
    expect(markup).not.toContain("<input");
  });
});
