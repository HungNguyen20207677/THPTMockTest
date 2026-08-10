export const EXAM_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  HIDDEN: "HIDDEN",
} as const;

export const EXAM_STATUSES = [
  EXAM_STATUS.DRAFT,
  EXAM_STATUS.PUBLISHED,
  EXAM_STATUS.HIDDEN,
] as const;

export const PART_ONE_CHOICES = ["A", "B", "C", "D"] as const;
export const PART_TWO_STATEMENTS = ["a", "b", "c", "d"] as const;
export const SHORT_ANSWER_SLOT_OPTIONS = [
  "-",
  ",",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
] as const;

export const EXAM_STRUCTURE = {
  durationMinutes: 90,
  totalQuestions: 22,
  partOneQuestions: 12,
  partTwoQuestions: 4,
  partTwoStatementsPerQuestion: 4,
  partThreeQuestions: 6,
  shortAnswerSlots: 4,
} as const;

export const EXAM_SCORING = {
  partOnePointsPerAnswer: 0.25,
  partOneMaximum: 3,
  partTwoPointsByCorrectStatements: {
    1: 0.1,
    2: 0.25,
    3: 0.5,
    4: 1,
  },
  partTwoMaximum: 4,
  partThreePointsPerAnswer: 0.5,
  partThreeMaximum: 3,
  totalMaximum: 10,
} as const;

export const EXAM_PDF_MAX_BYTES = 15 * 1024 * 1024;
export const EXAM_PDF_MIME_TYPE = "application/pdf";
export const EXAM_PDF_CLOUDINARY_FOLDER = "thpt-mock-test/exams";
