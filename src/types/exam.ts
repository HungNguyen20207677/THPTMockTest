import type {
  EXAM_STATUS,
  EXAM_VISIBILITY_MODE,
  PART3_INPUT_MODE,
  PART_ONE_CHOICES,
  SHORT_ANSWER_SLOT_OPTIONS,
} from "@/lib/constants/exam";

export type ExamStatus = (typeof EXAM_STATUS)[keyof typeof EXAM_STATUS];
export type ExamVisibilityMode =
  (typeof EXAM_VISIBILITY_MODE)[keyof typeof EXAM_VISIBILITY_MODE];
export type Part3InputMode =
  (typeof PART3_INPUT_MODE)[keyof typeof PART3_INPUT_MODE];
export type PartOneAnswer = (typeof PART_ONE_CHOICES)[number];
export type ShortAnswerSlotOption = (typeof SHORT_ANSWER_SLOT_OPTIONS)[number];
export type ShortAnswerSlot = ShortAnswerSlotOption | null;
export type ShortAnswerSlots = [
  ShortAnswerSlot,
  ShortAnswerSlot,
  ShortAnswerSlot,
  ShortAnswerSlot,
];

export interface PartTwoAnswer {
  a: boolean;
  b: boolean;
  c: boolean;
  d: boolean;
}

export interface ExamAnswerKey {
  partOne: PartOneAnswer[];
  partTwo: PartTwoAnswer[];
  partThree: string[];
}

export interface ExamQuestionTopicIds {
  partOne: string[][];
  partTwo: string[][];
  partThree: string[][];
}

export interface ExamSettings {
  allowRetake: boolean;
  showScoreAfterSubmission: boolean;
  showAnswersAfterSubmission: boolean;
}

export interface ExamPdf {
  publicId: string;
  secureUrl: string;
  originalFilename: string;
}

export interface ExamPdfSignedUploadFields {
  timestamp: string;
  public_id: string;
  overwrite: "0";
  allowed_formats: "pdf";
  filename_override: string;
  type: "upload";
}

export interface ExamPdfUploadTicket {
  uploadUrl: string;
  apiKey: string;
  signature: string;
  fields: ExamPdfSignedUploadFields;
}

export interface ExamPdfUploadReference {
  publicId: string;
  originalFilename: string;
  timestamp: number;
  signature: string;
}

export interface ExamSummary {
  id: string;
  title: string;
  status: ExamStatus;
  visibilityMode: ExamVisibilityMode;
  assignedStudentCount: number;
  settings: ExamSettings;
  hasAttempts: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExamDetail extends ExamSummary {
  description?: string;
  assignedStudentIds: string[];
  part3InputMode: Part3InputMode;
  pdf: ExamPdf;
  answerKey: ExamAnswerKey;
  questionTopicIds: ExamQuestionTopicIds;
}
