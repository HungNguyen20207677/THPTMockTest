import type {
  EXAM_STATUS,
  PART_ONE_CHOICES,
  SHORT_ANSWER_SLOT_OPTIONS,
} from "@/lib/constants/exam";

export type ExamStatus = (typeof EXAM_STATUS)[keyof typeof EXAM_STATUS];
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
  settings: ExamSettings;
  hasAttempts: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExamDetail extends ExamSummary {
  description?: string;
  pdf: ExamPdf;
  answerKey: ExamAnswerKey;
}
