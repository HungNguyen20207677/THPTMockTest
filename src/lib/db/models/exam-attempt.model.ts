import "server-only";

import { model, models, Schema, type Model, type Types } from "mongoose";

import {
  EXAM_ATTEMPT_STATUSES,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import { attemptAnswersSchema } from "@/lib/validations/attempt-answers";
import { attemptGradingSnapshotSchema } from "@/lib/validations/attempt-grading";
import type {
  AttemptAnswers,
  AttemptGradingSnapshot,
  ExamAttemptStatus,
} from "@/types/exam-attempt";

export interface ExamAttemptRecord {
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  attemptNumber: number;
  status: ExamAttemptStatus;
  startedAt: Date;
  expiresAt: Date;
  submittedAt?: Date;
  lastSavedAt?: Date;
  answers: AttemptAnswers;
  grading?: AttemptGradingSnapshot;
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
    attemptNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: EXAM_ATTEMPT_STATUSES,
      required: true,
    },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date },
    lastSavedAt: { type: Date },
    answers: {
      type: Schema.Types.Mixed,
      required: true,
      default: createEmptyAttemptAnswers,
      validate: {
        validator: (answers: unknown) =>
          attemptAnswersSchema.safeParse(answers).success,
        message: "Attempt answers must match the fixed THPT Math structure.",
      },
    },
    grading: {
      type: Schema.Types.Mixed,
      validate: {
        validator: (grading: unknown) =>
          attemptGradingSnapshotSchema.safeParse(grading).success,
        message: "Attempt grading must match the fixed THPT Math structure.",
      },
    },
    gradedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

examAttemptSchema.index(
  { studentId: 1, examId: 1, attemptNumber: 1 },
  { unique: true, name: "unique_attempt_number_per_student_exam" },
);
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

export const ExamAttemptModel =
  (models.ExamAttempt as Model<ExamAttemptRecord> | undefined) ??
  model<ExamAttemptRecord>("ExamAttempt", examAttemptSchema);
