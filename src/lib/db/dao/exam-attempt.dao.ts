import "server-only";

import type { ClientSession, Types } from "mongoose";

import {
  EXAM_ATTEMPT_STATUS,
  TERMINAL_EXAM_ATTEMPT_STATUSES,
} from "@/lib/constants/exam-attempt";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ExamAttemptModel } from "@/lib/db/models/exam-attempt.model";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import {
  examAttemptAnswersSchema,
  isDynamicAttemptAnswers,
} from "@/lib/validations/attempt-answers";
import { examAttemptGradingSnapshotSchema } from "@/lib/validations/attempt-grading";
import type {
  ExamAttemptStatus,
  ExamAttemptAnswers,
  ExamAttemptGradingSnapshot,
} from "@/types/exam-attempt";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";

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
  answers?: ExamAttemptAnswers;
  answerRevision: number;
  grading?: ExamAttemptGradingSnapshot;
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
  answers?: ExamAttemptAnswers;
}

export interface MutateOwnedExamAttemptInput {
  attemptId: string;
  examId: string;
  studentId: string;
  answers: ExamAttemptAnswers;
  now: Date;
  essayQuestionIds?: string[];
}

export interface MutateOwnedEssayImageInput {
  attemptId: string;
  examId: string;
  studentId: string;
  answers: ExamAttemptAnswers;
  expectedAnswerRevision: number;
  now: Date;
}

export interface FinalizeOwnedExamAttemptInput extends MutateOwnedExamAttemptInput {
  grading?: ExamAttemptGradingSnapshot;
}

export interface ExamAttemptReportFilter {
  studentId?: string;
  examId?: string;
  status?: (typeof TERMINAL_EXAM_ATTEMPT_STATUSES)[number];
}

export interface ExamAttemptStatusCounts {
  inProgress: number;
  submitted: number;
  autoSubmitted: number;
}

export interface ExamAttemptRegradeSource {
  id: string;
  answers: ExamAttemptAnswers;
}

export interface ExamAttemptGradingReplacement {
  attemptId: string;
  grading: ExamAttemptGradingSnapshot;
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
  answerRevision?: number;
  grading?: unknown;
  gradedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

let examAttemptIndexesPromise: Promise<void> | null = null;

function getAutoSubmitUpdate(now: Date, grading?: ExamAttemptGradingSnapshot) {
  return [
    {
      $set: {
        status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
        submittedAt: "$expiresAt",
        ...(grading ? { grading, gradedAt: now } : {}),
        updatedAt: now,
      },
    },
  ];
}

function getExpectedAnswerRevisionFilter(
  expectedAnswerRevision: number,
): Record<string, unknown> {
  return expectedAnswerRevision === 0
    ? {
        $or: [{ answerRevision: 0 }, { answerRevision: { $exists: false } }],
      }
    : { answerRevision: expectedAnswerRevision };
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
      : examAttemptAnswersSchema.safeParse(attempt.answers);
  const parsedGrading =
    attempt.grading === undefined
      ? null
      : examAttemptGradingSnapshotSchema.safeParse(attempt.grading);

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
    answerRevision: attempt.answerRevision ?? 0,
    grading: parsedGrading?.data,
    gradedAt: attempt.gradedAt,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
  };
}

function getAttemptScopeFilter(
  filter: Pick<ExamAttemptReportFilter, "studentId" | "examId">,
): Record<string, unknown> {
  return {
    ...(filter.studentId ? { studentId: filter.studentId } : {}),
    ...(filter.examId ? { examId: filter.examId } : {}),
  };
}

function getTerminalAttemptFilter(
  filter: ExamAttemptReportFilter,
): Record<string, unknown> {
  return {
    ...getAttemptScopeFilter(filter),
    status: filter.status ?? { $in: TERMINAL_EXAM_ATTEMPT_STATUSES },
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
  session?: ClientSession,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  let query = ExamAttemptModel.findOne({
    _id: attemptId,
    examId,
    studentId,
  });

  if (session) {
    query = query.session(session);
  }

  const attempt = await query.lean<ExamAttemptDocumentData>().exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function listAllExamAttemptRecordsForStudent(
  studentId: string,
): Promise<ExamAttemptPersistenceRecord[]> {
  await prepareExamAttemptModel();

  const attempts = await ExamAttemptModel.find({ studentId })
    .lean<ExamAttemptDocumentData[]>()
    .exec();

  return attempts.map(toExamAttemptRecord);
}

export async function createExamAttemptRecord(
  input: CreateExamAttemptRecordInput,
  session: ClientSession,
): Promise<ExamAttemptPersistenceRecord> {
  await prepareExamAttemptModel();

  const attempt = new ExamAttemptModel(input);
  await attempt.save({ session });
  return toExamAttemptRecord(attempt.toObject() as ExamAttemptDocumentData);
}

export async function saveOwnedActiveExamAttemptAnswers(
  input: MutateOwnedExamAttemptInput,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const essayQuestionIds = new Set(input.essayQuestionIds ?? []);
  const dynamicAnswers = isDynamicAttemptAnswers(input.answers)
    ? input.answers
    : null;
  const shouldMergeObjectiveAnswers =
    essayQuestionIds.size > 0 && dynamicAnswers !== null;
  const update = shouldMergeObjectiveAnswers
    ? [
        {
          $set: {
            answers: {
              $mergeObjects: [
                { $ifNull: ["$answers", {}] },
                {
                  answersByQuestionId: {
                    $mergeObjects: [
                      {
                        $ifNull: ["$answers.answersByQuestionId", {}],
                      },
                      {
                        $literal: Object.fromEntries(
                          Object.entries(
                            dynamicAnswers?.answersByQuestionId ?? {},
                          ).filter(
                            ([questionId]) => !essayQuestionIds.has(questionId),
                          ),
                        ),
                      },
                    ],
                  },
                },
              ],
            },
            lastSavedAt: input.now,
            answerRevision: {
              $add: [{ $ifNull: ["$answerRevision", 0] }, 1],
            },
            updatedAt: input.now,
          },
        },
      ]
    : {
        $set: {
          answers: input.answers,
          lastSavedAt: input.now,
        },
        $inc: { answerRevision: 1 },
      };

  const attempt = await ExamAttemptModel.findOneAndUpdate(
    {
      _id: input.attemptId,
      examId: input.examId,
      studentId: input.studentId,
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      expiresAt: { $gt: input.now },
    },
    update,
    {
      returnDocument: "after",
      ...(shouldMergeObjectiveAnswers ? {} : { runValidators: true }),
    },
  )
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

async function mutateOwnedActiveEssayImageAnswer(
  input: MutateOwnedEssayImageInput,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const attempt = await ExamAttemptModel.findOneAndUpdate(
    {
      _id: input.attemptId,
      examId: input.examId,
      studentId: input.studentId,
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      expiresAt: { $gt: input.now },
      ...getExpectedAnswerRevisionFilter(input.expectedAnswerRevision),
    },
    {
      $set: {
        answers: input.answers,
        lastSavedAt: input.now,
      },
      $inc: { answerRevision: 1 },
    },
    { returnDocument: "after", runValidators: true },
  )
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function attachEssayImageToOwnedActiveExamAttempt(
  input: MutateOwnedEssayImageInput,
): Promise<ExamAttemptPersistenceRecord | null> {
  return mutateOwnedActiveEssayImageAnswer(input);
}

export async function removeEssayImageFromOwnedActiveExamAttempt(
  input: MutateOwnedEssayImageInput,
): Promise<ExamAttemptPersistenceRecord | null> {
  return mutateOwnedActiveEssayImageAnswer(input);
}

export async function submitOwnedActiveExamAttempt(
  input: FinalizeOwnedExamAttemptInput,
  session: ClientSession,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const essayQuestionIds = new Set(input.essayQuestionIds ?? []);
  const dynamicAnswers = isDynamicAttemptAnswers(input.answers)
    ? input.answers
    : null;
  const shouldMergeObjectiveAnswers =
    essayQuestionIds.size > 0 && dynamicAnswers !== null;
  const objectiveAnswersByQuestionId = Object.fromEntries(
    Object.entries(dynamicAnswers?.answersByQuestionId ?? {}).filter(
      ([questionId]) => !essayQuestionIds.has(questionId),
    ),
  );
  const update = shouldMergeObjectiveAnswers
    ? [
        {
          $set: {
            answers: {
              $mergeObjects: [
                { $ifNull: ["$answers", {}] },
                {
                  answersByQuestionId: {
                    $mergeObjects: [
                      { $ifNull: ["$answers.answersByQuestionId", {}] },
                      { $literal: objectiveAnswersByQuestionId },
                    ],
                  },
                },
              ],
            },
            status: EXAM_ATTEMPT_STATUS.SUBMITTED,
            submittedAt: input.now,
            lastSavedAt: input.now,
            ...(input.grading
              ? { grading: { $literal: input.grading }, gradedAt: input.now }
              : {}),
            updatedAt: input.now,
          },
        },
      ]
    : {
        $set: {
          answers: input.answers,
          status: EXAM_ATTEMPT_STATUS.SUBMITTED,
          submittedAt: input.now,
          lastSavedAt: input.now,
          ...(input.grading
            ? { grading: input.grading, gradedAt: input.now }
            : {}),
        },
      };

  const attempt = await ExamAttemptModel.findOneAndUpdate(
    {
      _id: input.attemptId,
      examId: input.examId,
      studentId: input.studentId,
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      expiresAt: { $gt: input.now },
    },
    update,
    {
      returnDocument: "after",
      ...(shouldMergeObjectiveAnswers ? {} : { runValidators: true }),
      session,
    },
  )
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function autoSubmitExpiredExamAttemptRecord(
  attemptId: string,
  studentId: string,
  examId: string,
  expectedAnswerRevision: number,
  grading: ExamAttemptGradingSnapshot | undefined,
  now: Date,
  session: ClientSession,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const attempt = await ExamAttemptModel.findOneAndUpdate(
    {
      _id: attemptId,
      studentId,
      examId,
      ...getExpectedAnswerRevisionFilter(expectedAnswerRevision),
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      expiresAt: { $lte: now },
    },
    getAutoSubmitUpdate(now, grading),
    { returnDocument: "after", session },
  )
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function setOwnedTerminalExamAttemptGradingForRevision(
  attemptId: string,
  examId: string,
  studentId: string,
  grading: ExamAttemptGradingSnapshot,
  gradedAt: Date,
  session: ClientSession,
): Promise<ExamAttemptPersistenceRecord | null> {
  await prepareExamAttemptModel();

  const attempt = await ExamAttemptModel.findOneAndUpdate(
    {
      _id: attemptId,
      examId,
      studentId,
      status: { $in: TERMINAL_EXAM_ATTEMPT_STATUSES },
      $or: [
        { grading: { $exists: false } },
        { "grading.answerKeyRevision": { $exists: false } },
        {
          "grading.answerKeyRevision": {
            $lt: grading.answerKeyRevision,
          },
        },
      ],
    },
    { $set: { grading, gradedAt } },
    { returnDocument: "after", runValidators: true, session },
  )
    .lean<ExamAttemptDocumentData>()
    .exec();

  return attempt ? toExamAttemptRecord(attempt) : null;
}

export async function listTerminalExamAttemptRegradeSources(
  examId: string,
  session: ClientSession,
  structure?: ExamStructureSnapshot,
): Promise<ExamAttemptRegradeSource[]> {
  await prepareExamAttemptModel();

  const attempts = await ExamAttemptModel.find({
    examId,
    status: { $in: TERMINAL_EXAM_ATTEMPT_STATUSES },
  })
    .select({ answers: 1 })
    .session(session)
    .lean<Array<Pick<ExamAttemptDocumentData, "_id" | "answers">>>()
    .exec();

  return attempts.map((attempt) => {
    const parsedAnswers = examAttemptAnswersSchema.safeParse(
      attempt.answers ??
        (structure
          ? createEmptyAttemptAnswers(structure)
          : createEmptyAttemptAnswers()),
    );

    if (!parsedAnswers.success) {
      throw new Error("Stored ExamAttempt answers are malformed.");
    }

    return {
      id: attempt._id.toString(),
      answers: parsedAnswers.data,
    };
  });
}

export async function replaceTerminalExamAttemptGradings(
  examId: string,
  replacements: ExamAttemptGradingReplacement[],
  gradedAt: Date,
  session: ClientSession,
): Promise<number> {
  await prepareExamAttemptModel();

  if (replacements.length === 0) {
    return 0;
  }

  const validatedReplacements = replacements.map((replacement) => ({
    ...replacement,
    grading: examAttemptGradingSnapshotSchema.parse(replacement.grading),
  }));
  const result = await ExamAttemptModel.bulkWrite(
    validatedReplacements.map((replacement) => ({
      updateOne: {
        filter: {
          _id: replacement.attemptId,
          examId,
          status: { $in: TERMINAL_EXAM_ATTEMPT_STATUSES },
        },
        update: {
          $set: {
            grading: replacement.grading,
            gradedAt,
            updatedAt: gradedAt,
          },
        },
      },
    })),
    { ordered: true, session },
  );

  return result.matchedCount;
}

export async function hasExamAttemptRecords(examId: string): Promise<boolean> {
  await prepareExamAttemptModel();
  return Boolean(await ExamAttemptModel.exists({ examId }));
}

export async function deleteExamAttemptRecordsByExamId(
  examId: string,
  session: ClientSession,
): Promise<number> {
  await prepareExamAttemptModel();
  const result = await ExamAttemptModel.deleteMany({ examId }, { session });
  return result.deletedCount;
}

export async function deleteExamAttemptRecordsByStudentId(
  studentId: string,
  session: ClientSession,
): Promise<number> {
  await prepareExamAttemptModel();
  const result = await ExamAttemptModel.deleteMany({ studentId }, { session });
  return result.deletedCount;
}

export async function listExpiredExamAttemptRecords(
  now: Date,
  filter: Pick<ExamAttemptReportFilter, "studentId" | "examId"> = {},
): Promise<ExamAttemptPersistenceRecord[]> {
  await prepareExamAttemptModel();

  const attempts = await ExamAttemptModel.find({
    ...getAttemptScopeFilter(filter),
    status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
    expiresAt: { $lte: now },
  })
    .sort({ expiresAt: 1, _id: 1 })
    .lean<ExamAttemptDocumentData[]>()
    .exec();

  return attempts.map(toExamAttemptRecord);
}

export async function listActiveExamAttemptRecords(
  filter: Pick<ExamAttemptReportFilter, "studentId" | "examId"> = {},
): Promise<ExamAttemptPersistenceRecord[]> {
  await prepareExamAttemptModel();

  const attempts = await ExamAttemptModel.find({
    ...getAttemptScopeFilter(filter),
    status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
  })
    .lean<ExamAttemptDocumentData[]>()
    .exec();

  return attempts.map(toExamAttemptRecord);
}

export async function listTerminalExamAttemptRecords(
  filter: ExamAttemptReportFilter = {},
): Promise<ExamAttemptPersistenceRecord[]> {
  await prepareExamAttemptModel();

  const attempts = await ExamAttemptModel.find(getTerminalAttemptFilter(filter))
    .sort({ submittedAt: -1, _id: -1 })
    .lean<ExamAttemptDocumentData[]>()
    .exec();

  return attempts.map(toExamAttemptRecord);
}

export async function listTerminalExamAttemptRecordPage(
  filter: ExamAttemptReportFilter,
  page: number,
  pageSize: number,
): Promise<{ attempts: ExamAttemptPersistenceRecord[]; totalItems: number }> {
  await prepareExamAttemptModel();
  const query = getTerminalAttemptFilter(filter);
  const [attempts, totalItems] = await Promise.all([
    ExamAttemptModel.find(query)
      .sort({ submittedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<ExamAttemptDocumentData[]>()
      .exec(),
    ExamAttemptModel.countDocuments(query).exec(),
  ]);

  return {
    attempts: attempts.map(toExamAttemptRecord),
    totalItems,
  };
}

export async function countExamAttemptRecordsByStatus(): Promise<ExamAttemptStatusCounts> {
  await prepareExamAttemptModel();
  const [inProgress, submitted, autoSubmitted] = await Promise.all([
    ExamAttemptModel.countDocuments({
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
    }).exec(),
    ExamAttemptModel.countDocuments({
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
    }).exec(),
    ExamAttemptModel.countDocuments({
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
    }).exec(),
  ]);

  return { inProgress, submitted, autoSubmitted };
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
