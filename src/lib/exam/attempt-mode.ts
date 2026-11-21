import { EXAM_ATTEMPT_MODE } from "@/lib/constants/exam-attempt";

export function getMockExamAttemptFilter(): Record<string, unknown> {
  return {
    $or: [{ mode: EXAM_ATTEMPT_MODE.MOCK }, { mode: { $exists: false } }],
  };
}

export function withMockExamAttemptFilter(
  filter: Record<string, unknown>,
): Record<string, unknown> {
  return { ...filter, $and: [getMockExamAttemptFilter()] };
}
