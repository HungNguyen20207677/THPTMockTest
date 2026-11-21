import "server-only";

import { model, models, Schema, type Model, type Types } from "mongoose";

import {
  EXAM_ATTEMPT_GRADING_STATUSES,
  EXAM_ATTEMPT_MODE,
  EXAM_ATTEMPT_MODES,
  EXAM_ATTEMPT_STATUSES,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import { examAttemptAnswersSchema } from "@/lib/validations/attempt-answers";
import { examAttemptGradingSnapshotSchema } from "@/lib/validations/attempt-grading";
import type {
  ExamAttemptStatus,
  ExamAttemptMode,
  ExamAttemptAnswers,
  ExamAttemptGradingStatus,
  ExamAttemptGradingSnapshot,
} from "@/types/exam-attempt";

export interface ExamAttemptRecord {
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  mode: ExamAttemptMode;
  attemptNumber: number;
  status: ExamAttemptStatus;
  gradingStatus?: ExamAttemptGradingStatus;
  startedAt: Date;
  expiresAt: Date | null;
  submittedAt?: Date;
  lastSavedAt?: Date;
  answers: ExamAttemptAnswers;
  answerRevision: number;
  flaggedQuestionIds: string[];
  grading?: ExamAttemptGradingSnapshot;
  manualGradingRevision?: number;
  gradedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const examAttemptSchema = new Schema<ExamAttemptRecord>(
  {
    examId: {
      type: Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mode: {
      type: String,
      enum: EXAM_ATTEMPT_MODES,
      required: true,
      default: EXAM_ATTEMPT_MODE.MOCK,
      immutable: true,
    },
    attemptNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: EXAM_ATTEMPT_STATUSES,
      required: true,
    },
    gradingStatus: { type: String, enum: EXAM_ATTEMPT_GRADING_STATUSES },
    startedAt: { type: Date, required: true },
    expiresAt: {
      type: Date,
      default: null,
    },
    submittedAt: { type: Date },
    lastSavedAt: { type: Date },
    answers: {
      type: Schema.Types.Mixed,
      required: true,
      default: () => createEmptyAttemptAnswers(),
      validate: {
        validator: (answers: unknown) =>
          examAttemptAnswersSchema.safeParse(answers).success,
        message: "Attempt answers are malformed.",
      },
    },
    answerRevision: { type: Number, required: true, default: 0, min: 0 },
    flaggedQuestionIds: {
      type: [String],
      required: true,
      default: [],
    },
    grading: {
      type: Schema.Types.Mixed,
      validate: {
        validator: (grading: unknown) =>
          examAttemptGradingSnapshotSchema.safeParse(grading).success,
        message: "Attempt grading is malformed.",
      },
    },
    manualGradingRevision: { type: Number, min: 0 },
    gradedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

examAttemptSchema.pre("validate", function () {
  const validExpiration =
    this.mode === EXAM_ATTEMPT_MODE.PRACTICE
      ? this.expiresAt === null
      : this.expiresAt instanceof Date;
  if (!validExpiration) {
    this.invalidate("expiresAt", "Attempt expiration does not match its mode.");
  }
});

examAttemptSchema.index(
  { studentId: 1, examId: 1 },
  {
    unique: true,
    name: "unique_active_attempt_per_student_exam",
    partialFilterExpression: {
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
    },
  },
);
examAttemptSchema.index(
  { status: 1, submittedAt: -1, _id: -1 },
  { name: "results_by_submission" },
);
examAttemptSchema.index(
  { studentId: 1, status: 1, submittedAt: -1, _id: -1 },
  { name: "student_results_by_submission" },
);
examAttemptSchema.index(
  { examId: 1, status: 1, submittedAt: -1, _id: -1 },
  { name: "exam_results_by_submission" },
);
examAttemptSchema.index(
  { studentId: 1, examId: 1, status: 1, submittedAt: -1, _id: -1 },
  { name: "student_exam_results_by_submission" },
);
examAttemptSchema.index(
  { status: 1, expiresAt: 1 },
  { name: "expired_attempts" },
);

export const ExamAttemptModel =
  (models.ExamAttempt as Model<ExamAttemptRecord> | undefined) ??
  model<ExamAttemptRecord>("ExamAttempt", examAttemptSchema);
