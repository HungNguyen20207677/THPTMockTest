import { describe, expect, it } from "vitest";

import { collectEssayImagePublicIds } from "@/lib/exam/essay-image-resources";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import type { EssayImage, ExamAttemptAnswers } from "@/types/exam-attempt";

function createImage(publicId: string): EssayImage {
  return {
    publicId,
    secureUrl: `https://res.cloudinary.com/test/image/upload/${publicId}.jpg`,
    originalFilename: `${publicId}.jpg`,
    bytes: 1024,
    format: "jpg",
    width: 1200,
    height: 800,
  };
}

describe("essay-image hard-delete resource collection", () => {
  it("collects and deduplicates every image across questions and attempts", () => {
    const pendingManualAnswers: ExamAttemptAnswers = {
      answersByQuestionId: {
        "essay-one": {
          type: "ESSAY_IMAGE",
          images: [createImage("image-1"), createImage("image-2")],
        },
        choice: "A",
        "essay-two": {
          type: "ESSAY_IMAGE",
          images: [createImage("image-3")],
        },
      },
    };
    const completedAnswers: ExamAttemptAnswers = {
      answersByQuestionId: {
        essay: {
          type: "ESSAY_IMAGE",
          images: [createImage("image-1"), createImage("image-4")],
        },
      },
    };

    expect(
      collectEssayImagePublicIds([
        { answers: pendingManualAnswers },
        { answers: completedAnswers },
        { answers: createEmptyAttemptAnswers() },
      ]),
    ).toEqual(["image-1", "image-2", "image-3", "image-4"]);
  });
});
