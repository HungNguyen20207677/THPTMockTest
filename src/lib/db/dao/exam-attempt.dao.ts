import "server-only";

import type { Types } from "mongoose";

import {
  EXAM_ATTEMPT_STATUS,
  TERMINAL_EXAM_ATTEMPT_STATUSES,
} from "@/lib/constants/exam-attempt";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ExamAttemptModel } from "@/lib/db/models/exam-attempt.model";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import { attemptAnswersSchema } from "@/lib/validations/attempt-answers";
import { attemptGradingSnapshotSchema } from "@/lib/validations/attempt-grading";
import type {
  AttemptAnswers,
  AttemptGradingSnapshot,
  ExamAttemptStatus,
} from "@/types/exam-attempt";

export interface ExamAttemptPersistenceRecord {
  id: string;
  examId: string;
  studentId: string;
  attemptNumber: number;
  status: ExamAttemptStatus;
  startedAt: Date;
  expiresAt: Date;
  submittedAt?: Date;
  lastSavedAt?: Date;
  answers?: AttemptAnswers;
  grading?: AttemptGradingSnapshot;
  gradedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExamAttemptRecordInput {
  examId: string;
  studentId: string;
  attemptNumber: number;
  status: typeof EXAM_ATTEMPT_STATUS.IN_PROGRESS;
  startedAt: Date;
  expiresAt: Date;
}

export interface MutateOwnedExamAttemptInput {
  attemptId: string;
  examId: string;
  studentId: string;
  answers: AttemptAnswers;
  now: Date;
}

export interface FinalizeOwnedExamAttemptInput extends MutateOwnedExamAttemptInput {
  grading: AttemptGradingSnapshot;
}

interface ExamAttemptDocumentData {
  _id: Types.ObjectId;
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  attemptNumber: number;
  status: ExamAttemptStatus;
  startedAt: Date;
  expiresAt: Date;
  submittedAt?: Date;
  lastSavedAt?: Date;
  answers?: unknown;
  grading?: unknown;
  gradedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

let examAttemptIndexesPromise: Promise<void> | null = null;

function getAutoSubmitUpdate(now: Date, grading: AttemptGradingSnapshot) {
  return [
    {
      $set: {
        status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
        submittedAt: "$expiresAt",
        grading,
        gradedAt: now,
        updatedAt: now,
      },
    },
  ];
}

async function prepareExamAttemptModel(): Promise<void> {
  await connectToDatabase();

  if (!examAttemptIndexesPromise) {
    examAttemptIndexesPromise = ExamAttemptModel.init()
      .then(() => undefined)
      .catch((error: unknown) => {
        examAttemptIndexesPromise = null;
        throw error;
      });
  }

  await examAttemptIndexesPromise;
}

function toExamAttemptRecord(
  attempt: ExamAttemptDocumentData,
): ExamAttemptPersistenceRecord {
  const parsedAnswers =
    attempt.answers === undefined
      ? null
      : attemptAnswersSchema.safeParse(attempt.answers);
  const parsedGrading =
    attempt.grading === undefined
      ? null
      : attemptGradingSnapshotSchema.safeParse(attempt.grading);

  if (parsedGrading && !parsedGrading.success) {
    throw new Error("Stored ExamAttempt grading is malformed.");
  }

  if (parsedAnswers && !parsedAnswers.success) {
    throw new Error("Stored ExamAttempt answers are malformed.");
  }

  return {
    id: attempt._id.toString(),
    examId: attempt.examId.toString(),
    studentId: attempt.studentId.toString(),
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    lastSavedAt: attempt.lastSavedAt,
    answers: parsedAnswers?.data ?? createEmptyAttemptAnswers(),
    grading: parsedGrading?.data,
    gradedAt: attempt.gradedAt,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
  };
}

export async function findActiveExamAttemptRecord(
  studentId: string,
  examId: string,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const attempt = await ExamAttemptModel.findOne({
    studentId,
    examId,
    status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
  })
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function findLatestExamAttemptRecord(
  studentId: string,
  examId: string,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const attempt = await ExamAttemptModel.findOne({ studentId, examId })
    .sort({ attemptNumber: -1 })
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function findExamAttemptRecordById(
  attemptId: string,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const attempt = await ExamAttemptModel.findById(attemptId)
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function findOwnedExamAttemptRecord(
  attemptId: string,
  examId: string,
  studentId: string,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const attempt = await ExamAttemptModel.findOne({
    _id: attemptId,
    examId,
    studentId,
  })
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function listExamAttemptRecordsForStudent(
  studentId: string,
  examIds: string[],
): Promise<ExamAttemptPersistenceRecord[]> {
  await prepareExamAttemptModel();

  if (examIds.length === 0) {
    return [];
  }

  const attempts = await ExamAttemptModel.find({
    studentId,
    examId: { $in: examIds },
  })
    .sort({ attemptNumber: -1 })
    .lean<ExamAttemptDocumentData[]>()
    .exec();

  return attempts.map(toExamAttemptRecord);
}

export async function createExamAttemptRecord(
  input: CreateExamAttemptRecordInput,
): Promise<ExamAttemptPersistenceRecord> {
  await prepareExamAttemptModel();

  const attempt = await ExamAttemptModel.create(input);
  return toExamAttemptRecord(attempt.toObject() as ExamAttemptDocumentData);
}

export async function saveOwnedActiveExamAttemptAnswers(
  input: MutateOwnedExamAttemptInput,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const attempt = await ExamAttemptModel.findOneAndUpdate(
    {
      _id: input.attemptId,
      examId: input.examId,
      studentId: input.studentId,
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      expiresAt: { $gt: input.now },
    },
    {
      $set: {
        answers: input.answers,
        lastSavedAt: input.now,
      },
    },
    { returnDocument: "after", runValidators: true },
  )
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function submitOwnedActiveExamAttempt(
  input: FinalizeOwnedExamAttemptInput,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const attempt = await ExamAttemptModel.findOneAndUpdate(
    {
      _id: input.attemptId,
      examId: input.examId,
      studentId: input.studentId,
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      expiresAt: { $gt: input.now },
    },
    {
      $set: {
        answers: input.answers,
        status: EXAM_ATTEMPT_STATUS.SUBMITTED,
        submittedAt: input.now,
        lastSavedAt: input.now,
        grading: input.grading,
        gradedAt: input.now,
      },
    },
    { returnDocument: "after", runValidators: true },
  )
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function autoSubmitExpiredExamAttemptRecord(
  attemptId: string,
  studentId: string,
  examId: string,
  expectedUpdatedAt: Date,
  grading: AttemptGradingSnapshot,
  now: Date,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const attempt = await ExamAttemptModel.findOneAndUpdate(
    {
      _id: attemptId,
      studentId,
      examId,
      updatedAt: expectedUpdatedAt,
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      expiresAt: { $lte: now },
    },
    getAutoSubmitUpdate(now, grading),
    { returnDocument: "after" },
  )
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function setOwnedTerminalExamAttemptGradingIfMissing(
  attemptId: string,
  examId: string,
  studentId: string,
  grading: AttemptGradingSnapshot,
  gradedAt: Date,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const attempt = await ExamAttemptModel.findOneAndUpdate(
    {
      _id: attemptId,
      examId,
      studentId,
      status: { $in: TERMINAL_EXAM_ATTEMPT_STATUSES },
      grading: { $exists: false },
    },
    { $set: { grading, gradedAt } },
    { returnDocument: "after", runValidators: true },
  )
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function hasExamAttemptRecords(examId: string): Promise<boolean> {
  await prepareExamAttemptModel();
  return Boolean(await ExamAttemptModel.exists({ examId }));
}

export async function findExamIdsWithAttemptRecords(
  examIds: string[],
): Promise<Set<string>> {
  await prepareExamAttemptModel();

  if (examIds.length === 0) {
    return new Set();
  }

  const ids = await ExamAttemptModel.distinct("examId", {
    examId: { $in: examIds },
  }).exec();

  return new Set(ids.map((examId) => examId.toString()));
}
