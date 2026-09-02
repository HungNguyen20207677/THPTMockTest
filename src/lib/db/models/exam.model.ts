import "server-only";

import { model, models, Schema, type Model, type Types } from "mongoose";

import {
  EXAM_STATUSES,
  EXAM_STRUCTURE,
  EXAM_VISIBILITY_MODE,
  EXAM_VISIBILITY_MODES,
  INITIAL_ANSWER_KEY_REVISION,
  PART3_INPUT_MODE,
  PART3_INPUT_MODES,
  PART_ONE_CHOICES,
} from "@/lib/constants/exam";
import { isValidCanonicalShortAnswer } from "@/lib/exam/short-answer";
import type {
  ExamAnswerKey,
  ExamPdf,
  ExamQuestionTopicIds,
  ExamSettings,
  ExamStatus,
  ExamVisibilityMode,
  Part3InputMode,
  PartOneAnswer,
  PartTwoAnswer,
} from "@/types/exam";

type ExamQuestionTopicObjectIds = {
  [TSection in keyof ExamQuestionTopicIds]: Types.ObjectId[][];
};

export interface ExamRecord {
  title: string;
  description?: string;
  status: ExamStatus;
  visibilityMode: ExamVisibilityMode;
  assignedStudentIds: Types.ObjectId[];
  part3InputMode: Part3InputMode;
  pdf: ExamPdf;
  settings: ExamSettings;
  answerKey: ExamAnswerKey;
  questionTopicIds: ExamQuestionTopicObjectIds;
  answerKeyRevision: number;
  attemptsStarted: boolean;
  attemptOperationVersion: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExamPdfOperationLeaseRecord {
  _id: string;
  token: string;
  expiresAt: Date;
}

const pdfSchema = new Schema<ExamPdf>(
  {
    publicId: { type: String, required: true },
    secureUrl: { type: String, required: true },
    originalFilename: { type: String, required: true, maxlength: 255 },
  },
  { _id: false },
);

const settingsSchema = new Schema<ExamSettings>(
  {
    allowRetake: { type: Boolean, required: true },
    showScoreAfterSubmission: { type: Boolean, required: true },
    showAnswersAfterSubmission: { type: Boolean, required: true },
  },
  { _id: false },
);

const partTwoAnswerSchema = new Schema<PartTwoAnswer>(
  {
    a: { type: Boolean, required: true },
    b: { type: Boolean, required: true },
    c: { type: Boolean, required: true },
    d: { type: Boolean, required: true },
  },
  { _id: false },
);

const answerKeySchema = new Schema<ExamAnswerKey>(
  {
    partOne: {
      type: [String],
      enum: PART_ONE_CHOICES,
      required: true,
      validate: {
        validator: (answers: PartOneAnswer[]) =>
          answers.length === EXAM_STRUCTURE.partOneQuestions,
        message: "Part I must contain exactly 12 answers.",
      },
    },
    partTwo: {
      type: [partTwoAnswerSchema],
      required: true,
      validate: {
        validator: (answers: PartTwoAnswer[]) =>
          answers.length === EXAM_STRUCTURE.partTwoQuestions,
        message: "Part II must contain exactly 4 questions.",
      },
    },
    partThree: {
      type: [String],
      required: true,
      validate: {
        validator: (answers: string[]) =>
          answers.length === EXAM_STRUCTURE.partThreeQuestions &&
          answers.every(isValidCanonicalShortAnswer),
        message: "Part III must contain exactly 6 valid short answers.",
      },
    },
  },
  { _id: false },
);

function isValidQuestionTopicSection(
  questions: Types.ObjectId[][],
  expectedLength: number,
): boolean {
  return (
    questions.length === expectedLength &&
    questions.every(
      (topicIds) =>
        new Set(topicIds.map((topicId) => topicId.toString())).size ===
        topicIds.length,
    )
  );
}

const questionTopicIdsSchema = new Schema<ExamQuestionTopicObjectIds>(
  {
    partOne: {
      type: [[{ type: Schema.Types.ObjectId, ref: "Topic" }]],
      required: true,
      validate: {
        validator: (questions: Types.ObjectId[][]) =>
          isValidQuestionTopicSection(
            questions,
            EXAM_STRUCTURE.partOneQuestions,
          ),
        message: "Part I topic assignments must contain exactly 12 questions.",
      },
    },
    partTwo: {
      type: [[{ type: Schema.Types.ObjectId, ref: "Topic" }]],
      required: true,
      validate: {
        validator: (questions: Types.ObjectId[][]) =>
          isValidQuestionTopicSection(
            questions,
            EXAM_STRUCTURE.partTwoQuestions,
          ),
        message: "Part II topic assignments must contain exactly 4 questions.",
      },
    },
    partThree: {
      type: [[{ type: Schema.Types.ObjectId, ref: "Topic" }]],
      required: true,
      validate: {
        validator: (questions: Types.ObjectId[][]) =>
          isValidQuestionTopicSection(
            questions,
            EXAM_STRUCTURE.partThreeQuestions,
          ),
        message: "Part III topic assignments must contain exactly 6 questions.",
      },
    },
  },
  { _id: false },
);

const examSchema = new Schema<ExamRecord>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: EXAM_STATUSES,
      required: true,
      index: true,
    },
    visibilityMode: {
      type: String,
      enum: EXAM_VISIBILITY_MODES,
      required: true,
      default: EXAM_VISIBILITY_MODE.ALL_STUDENTS,
    },
    assignedStudentIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    part3InputMode: {
      type: String,
      enum: PART3_INPUT_MODES,
      required: true,
      default: PART3_INPUT_MODE.BUBBLE,
    },
    pdf: { type: pdfSchema, required: true },
    settings: { type: settingsSchema, required: true },
    answerKey: { type: answerKeySchema, required: true },
    questionTopicIds: {
      type: questionTopicIdsSchema,
      required: true,
      default: () => ({
        partOne: Array.from(
          { length: EXAM_STRUCTURE.partOneQuestions },
          () => [],
        ),
        partTwo: Array.from(
          { length: EXAM_STRUCTURE.partTwoQuestions },
          () => [],
        ),
        partThree: Array.from(
          { length: EXAM_STRUCTURE.partThreeQuestions },
          () => [],
        ),
      }),
    },
    answerKeyRevision: {
      type: Number,
      required: true,
      default: INITIAL_ANSWER_KEY_REVISION,
      min: INITIAL_ANSWER_KEY_REVISION,
      validate: {
        validator: Number.isInteger,
        message: "Answer-key revision must be an integer.",
      },
    },
    attemptsStarted: { type: Boolean, required: true, default: false },
    attemptOperationVersion: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      select: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

examSchema.index({ createdAt: -1 });
examSchema.index({ assignedStudentIds: 1 });
examSchema.index({ "pdf.publicId": 1 }, { unique: true });

const examPdfOperationLeaseSchema = new Schema<ExamPdfOperationLeaseRecord>(
  {
    _id: { type: String, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

examPdfOperationLeaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ExamModel =
  (models.Exam as Model<ExamRecord> | undefined) ??
  model<ExamRecord>("Exam", examSchema);

export const ExamPdfOperationLeaseModel =
  (models.ExamPdfOperationLease as
    Model<ExamPdfOperationLeaseRecord> | undefined) ??
  model<ExamPdfOperationLeaseRecord>(
    "ExamPdfOperationLease",
    examPdfOperationLeaseSchema,
  );
