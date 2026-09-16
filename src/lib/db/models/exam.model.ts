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
} from "@/lib/constants/exam";
import { examStructureSnapshotMongooseSchema } from "@/lib/db/schemas/exam-structure.schema";
import { anyExamAnswerKeySchema } from "@/lib/validations/exam";
import type {
  AnyExamAnswerKey,
  ExamPdf,
  ExamQuestionTopic,
  ExamQuestionTopicIds,
  ExamSettings,
  ExamStatus,
  ExamVisibilityMode,
  Part3InputMode,
} from "@/types/exam";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";

type LegacyExamQuestionTopicObjectIds = {
  [TSection in keyof ExamQuestionTopicIds]: Types.ObjectId[][];
};

interface ExamQuestionTopicObjectIds {
  questionId: string;
  topicIds: Types.ObjectId[];
}

export interface ExamRecord {
  title: string;
  description?: string;
  status: ExamStatus;
  visibilityMode: ExamVisibilityMode;
  assignedStudentIds: Types.ObjectId[];
  part3InputMode: Part3InputMode;
  structureTemplateId?: Types.ObjectId;
  structureSnapshot?: ExamStructureSnapshot;
  pdf: ExamPdf;
  settings: ExamSettings;
  answerKey: AnyExamAnswerKey;
  questionTopicIds: LegacyExamQuestionTopicObjectIds;
  questionTopics?: ExamQuestionTopicObjectIds[];
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

const questionTopicIdsSchema = new Schema<LegacyExamQuestionTopicObjectIds>(
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

const questionTopicSchema = new Schema<ExamQuestionTopicObjectIds>(
  {
    questionId: { type: String, required: true, trim: true },
    topicIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Topic" }],
      default: [],
      validate: {
        validator: (topicIds: Types.ObjectId[]) =>
          new Set(topicIds.map((topicId) => topicId.toString())).size ===
          topicIds.length,
        message: "Question topic IDs must be unique.",
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
    structureTemplateId: {
      type: Schema.Types.ObjectId,
      ref: "ExamStructureTemplate",
      immutable: true,
    },
    structureSnapshot: {
      type: examStructureSnapshotMongooseSchema,
      immutable: true,
    },
    pdf: { type: pdfSchema, required: true },
    settings: { type: settingsSchema, required: true },
    answerKey: {
      type: Schema.Types.Mixed,
      required: true,
      validate: {
        validator: (answerKey: unknown) =>
          anyExamAnswerKeySchema.safeParse(answerKey).success,
        message: "Exam answer key is malformed.",
      },
    },
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
    questionTopics: {
      type: [questionTopicSchema],
      default: undefined,
      validate: {
        validator: (questionTopics: ExamQuestionTopic[]) =>
          new Set(
            questionTopics.map((questionTopic) => questionTopic.questionId),
          ).size === questionTopics.length,
        message: "Question topic assignments must use unique question IDs.",
      },
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
examSchema.index({ "questionTopicIds.partOne": 1 });
examSchema.index({ "questionTopicIds.partTwo": 1 });
examSchema.index({ "questionTopicIds.partThree": 1 });
examSchema.index({ "questionTopics.topicIds": 1 });

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
