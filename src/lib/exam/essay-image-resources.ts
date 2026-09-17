import { isDynamicAttemptAnswers } from "@/lib/validations/attempt-answers";
import type { ExamAttemptAnswers } from "@/types/exam-attempt";

export function collectEssayImagePublicIds(
  attempts: Array<{ answers?: ExamAttemptAnswers }>,
): string[] {
  const publicIds = new Set<string>();

  for (const attempt of attempts) {
    if (!attempt.answers || !isDynamicAttemptAnswers(attempt.answers)) {
      continue;
    }

    for (const answer of Object.values(attempt.answers.answersByQuestionId)) {
      if (
        typeof answer === "object" &&
        answer !== null &&
        "type" in answer &&
        answer.type === "ESSAY_IMAGE"
      ) {
        for (const image of answer.images) {
          publicIds.add(image.publicId);
        }
      }
    }
  }

  return [...publicIds];
}
