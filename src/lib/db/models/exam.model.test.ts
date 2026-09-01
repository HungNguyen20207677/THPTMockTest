import { describe, expect, it } from "vitest";

import {
  EXAM_VISIBILITY_MODE,
  INITIAL_ANSWER_KEY_REVISION,
  PART3_INPUT_MODE,
} from "@/lib/constants/exam";
import { ExamModel } from "@/lib/db/models/exam.model";

describe("Exam model", () => {
  it("defaults legacy-compatible fields for new documents", () => {
    const exam = new ExamModel();

    expect(exam.part3InputMode).toBe(PART3_INPUT_MODE.BUBBLE);
    expect(exam.answerKeyRevision).toBe(INITIAL_ANSWER_KEY_REVISION);
    expect(exam.visibilityMode).toBe(EXAM_VISIBILITY_MODE.ALL_STUDENTS);
    expect(exam.assignedStudentIds).toEqual([]);
  });
});
