import { describe, expect, it } from "vitest";

import { PART3_INPUT_MODE } from "@/lib/constants/exam";
import { ExamModel } from "@/lib/db/models/exam.model";

describe("Exam model", () => {
  it("defaults new documents without a Part III input mode to BUBBLE", () => {
    const exam = new ExamModel();

    expect(exam.part3InputMode).toBe(PART3_INPUT_MODE.BUBBLE);
  });
});
