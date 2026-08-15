import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectToDatabase: vi.fn(),
  examInit: vi.fn(),
  leaseInit: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("@/lib/db/mongoose", () => ({
  connectToDatabase: mocks.connectToDatabase,
}));

vi.mock("@/lib/db/models/exam.model", () => ({
  ExamModel: {
    init: mocks.examInit,
    findById: mocks.findById,
  },
  ExamPdfOperationLeaseModel: {
    init: mocks.leaseInit,
  },
}));

import { EXAM_STATUS, PART3_INPUT_MODE } from "@/lib/constants/exam";
import {
  findExamRecordById,
  findStudentExamRecordById,
} from "@/lib/db/dao/exam.dao";

const legacyExam = {
  _id: { toString: () => "legacy-exam-id" },
  title: "Legacy exam",
  status: EXAM_STATUS.PUBLISHED,
  pdf: {
    publicId: "legacy.pdf",
    secureUrl: "https://example.com/legacy.pdf",
    originalFilename: "legacy.pdf",
  },
  settings: {
    allowRetake: true,
    showScoreAfterSubmission: true,
    showAnswersAfterSubmission: false,
  },
  answerKey: { partOne: [], partTwo: [], partThree: [] },
  createdBy: { toString: () => "admin-id" },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("Exam DAO compatibility", () => {
  beforeEach(() => {
    mocks.connectToDatabase.mockReset();
    mocks.connectToDatabase.mockResolvedValue(undefined);
    mocks.examInit.mockResolvedValue(undefined);
    mocks.leaseInit.mockResolvedValue(undefined);
    mocks.findById.mockReset();
  });

  it("maps a legacy Exam without a Part III mode to BUBBLE", async () => {
    mocks.findById.mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(legacyExam) }),
    });

    const exam = await findExamRecordById("legacy-exam-id");

    expect(exam?.part3InputMode).toBe(PART3_INPUT_MODE.BUBBLE);
    expect(exam?.answerKeyRevision).toBe(1);
  });

  it("maps the legacy student workspace safely to BUBBLE", async () => {
    const select = vi.fn().mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(legacyExam) }),
    });
    mocks.findById.mockReturnValue({ select });

    const exam = await findStudentExamRecordById("legacy-exam-id");

    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ part3InputMode: 1 }),
    );
    expect(exam?.part3InputMode).toBe(PART3_INPUT_MODE.BUBBLE);
    expect(exam).not.toHaveProperty("answerKey");
  });
});
