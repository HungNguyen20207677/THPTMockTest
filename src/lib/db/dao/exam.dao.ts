import "server-only";

import { randomUUID } from "node:crypto";

import type { ClientSession, Types } from "mongoose";

import { EXAM_STATUS } from "@/lib/constants/exam";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  ExamModel,
  ExamPdfOperationLeaseModel,
} from "@/lib/db/models/exam.model";
import { isMongoDuplicateKeyError } from "@/lib/db/errors";
import type {
  ExamAnswerKey,
  ExamPdf,
  ExamSettings,
  ExamStatus,
} from "@/types/exam";

export interface ExamPersistenceRecord {
  id: string;
  title: string;
  description?: string;
  status: ExamStatus;
  pdf: ExamPdf;
  settings: ExamSettings;
  answerKey: ExamAnswerKey;
  attemptsStarted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveExamRecordInput {
  title: string;
  description?: string;
  status: ExamStatus;
  pdf: ExamPdf;
  settings: ExamSettings;
  answerKey: ExamAnswerKey;
}

export interface UpdateExamMetadataRecordInput {
  title: string;
  description?: string;
  status: ExamStatus;
  settings: ExamSettings;
}

export interface StudentExamPersistenceRecord {
  id: string;
  title: string;
  description?: string;
  status: ExamStatus;
  allowRetake: boolean;
  attemptsStarted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentExamWorkspacePersistenceRecord extends StudentExamPersistenceRecord {
  pdf: Pick<ExamPdf, "secureUrl" | "originalFilename">;
}

export interface ExamGradingPersistenceRecord {
  id: string;
  title: string;
  answerKey: ExamAnswerKey;
  settings: Pick<
    ExamSettings,
    "showScoreAfterSubmission" | "showAnswersAfterSubmission"
  >;
}

export interface ExamReportingPersistenceRecord extends ExamGradingPersistenceRecord {
  status: ExamStatus;
}

interface ExamDocumentData {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  status: ExamStatus;
  pdf: ExamPdf;
  settings: ExamSettings;
  answerKey: ExamAnswerKey;
  attemptsStarted?: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface StudentExamDocumentData {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  status: ExamStatus;
  settings: { allowRetake: boolean };
  attemptsStarted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface StudentExamWorkspaceDocumentData extends StudentExamDocumentData {
  pdf: Pick<ExamPdf, "secureUrl" | "originalFilename">;
}

interface ExamGradingDocumentData {
  _id: Types.ObjectId;
  title: string;
  answerKey: ExamAnswerKey;
  settings: Pick<
    ExamSettings,
    "showScoreAfterSubmission" | "showAnswersAfterSubmission"
  >;
}

interface ExamReportingDocumentData extends ExamGradingDocumentData {
  status: ExamStatus;
}

let examIndexesPromise: Promise<void> | null = null;
const EXAM_PDF_OPERATION_LEASE_DURATION_MS = 60 * 60 * 1000;

export interface ExamPdfOperationLease {
  publicId: string;
  token: string;
}

async function prepareExamModel(): Promise<void> {
  await connectToDatabase();

  if (!examIndexesPromise) {
    examIndexesPromise = Promise.all([
      ExamModel.init(),
      ExamPdfOperationLeaseModel.init(),
    ])
      .then(() => undefined)
      .catch((error: unknown) => {
        examIndexesPromise = null;
        throw error;
      });
  }

  await examIndexesPromise;
}

export async function acquireExamPdfOperationLease(
  publicId: string,
): Promise<ExamPdfOperationLease | null> {
  await prepareExamModel();

  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + EXAM_PDF_OPERATION_LEASE_DURATION_MS,
  );
  const reclaimedLease = await ExamPdfOperationLeaseModel.findOneAndUpdate(
    { _id: publicId, expiresAt: { $lte: now } },
    { $set: { token, expiresAt } },
    { returnDocument: "after" },
  ).exec();

  if (reclaimedLease) {
    return { publicId, token };
  }

  try {
    await ExamPdfOperationLeaseModel.create({
      _id: publicId,
      token,
      expiresAt,
    });

    return { publicId, token };
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      return null;
    }

    throw error;
  }
}

export async function releaseExamPdfOperationLease(
  lease: ExamPdfOperationLease,
): Promise<void> {
  await prepareExamModel();
  await ExamPdfOperationLeaseModel.deleteOne({
    _id: lease.publicId,
    token: lease.token,
  }).exec();
}

function toExamRecord(exam: ExamDocumentData): ExamPersistenceRecord {
  return {
    id: exam._id.toString(),
    title: exam.title,
    description: exam.description,
    status: exam.status,
    pdf: exam.pdf,
    settings: exam.settings,
    answerKey: exam.answerKey,
    attemptsStarted: exam.attemptsStarted === true,
    createdBy: exam.createdBy.toString(),
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
  };
}

function toStudentExamRecord(
  exam: StudentExamDocumentData,
): StudentExamPersistenceRecord {
  return {
    id: exam._id.toString(),
    title: exam.title,
    description: exam.description,
    status: exam.status,
    allowRetake: exam.settings.allowRetake,
    attemptsStarted: exam.attemptsStarted === true,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
  };
}

function toStudentExamWorkspaceRecord(
  exam: StudentExamWorkspaceDocumentData,
): StudentExamWorkspacePersistenceRecord {
  return {
    ...toStudentExamRecord(exam),
    pdf: {
      secureUrl: exam.pdf.secureUrl,
      originalFilename: exam.pdf.originalFilename,
    },
  };
}

function toExamGradingRecord(
  exam: ExamGradingDocumentData,
): ExamGradingPersistenceRecord {
  return {
    id: exam._id.toString(),
    title: exam.title,
    answerKey: exam.answerKey,
    settings: exam.settings,
  };
}

function toExamReportingRecord(
  exam: ExamReportingDocumentData,
): ExamReportingPersistenceRecord {
  return {
    ...toExamGradingRecord(exam),
    status: exam.status,
  };
}

export async function listExamRecords(): Promise<ExamPersistenceRecord[]> {
  await prepareExamModel();

  const exams = await ExamModel.find()
    .sort({ createdAt: -1 })
    .lean<ExamDocumentData[]>()
    .exec();

  return exams.map(toExamRecord);
}

export async function findExamRecordById(
  examId: string,
): Promise<ExamPersistenceRecord | null> {
  await prepareExamModel();

  const exam = await ExamModel.findById(examId).lean<ExamDocumentData>().exec();

  return exam ? toExamRecord(exam) : null;
}

export async function listPublishedStudentExamRecords(): Promise<
  StudentExamPersistenceRecord[]
> {
  await prepareExamModel();

  const exams = await ExamModel.find({ status: EXAM_STATUS.PUBLISHED })
    .select({
      title: 1,
      description: 1,
      status: 1,
      "settings.allowRetake": 1,
      attemptsStarted: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .sort({ createdAt: -1, _id: -1 })
    .lean<StudentExamDocumentData[]>()
    .exec();

  return exams.map(toStudentExamRecord);
}

export async function listStudentExamRecordsByIds(
  examIds: string[],
): Promise<StudentExamPersistenceRecord[]> {
  await prepareExamModel();

  if (examIds.length === 0) {
    return [];
  }

  const exams = await ExamModel.find({ _id: { $in: examIds } })
    .select({
      title: 1,
      description: 1,
      status: 1,
      "settings.allowRetake": 1,
      attemptsStarted: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .sort({ createdAt: -1, _id: -1 })
    .lean<StudentExamDocumentData[]>()
    .exec();

  return exams.map(toStudentExamRecord);
}

export async function findStudentExamRecordById(
  examId: string,
): Promise<StudentExamWorkspacePersistenceRecord | null> {
  await prepareExamModel();

  const exam = await ExamModel.findById(examId)
    .select({
      title: 1,
      description: 1,
      status: 1,
      "settings.allowRetake": 1,
      attemptsStarted: 1,
      "pdf.secureUrl": 1,
      "pdf.originalFilename": 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .lean<StudentExamWorkspaceDocumentData>()
    .exec();

  return exam ? toStudentExamWorkspaceRecord(exam) : null;
}

export async function markExamAttemptsStarted(
  examId: string,
  expectedUpdatedAt: Date,
): Promise<boolean> {
  await prepareExamModel();

  const result = await ExamModel.updateOne(
    {
      _id: examId,
      status: EXAM_STATUS.PUBLISHED,
      updatedAt: expectedUpdatedAt,
      attemptsStarted: { $ne: true },
    },
    { $set: { attemptsStarted: true } },
    { runValidators: true },
  ).exec();

  return result.matchedCount === 1;
}

export async function reserveExamForAttemptCreation(
  examId: string,
  session: ClientSession,
): Promise<boolean> {
  await prepareExamModel();

  const result = await ExamModel.updateOne(
    { _id: examId, status: EXAM_STATUS.PUBLISHED },
    {
      $set: { attemptsStarted: true },
      $inc: { attemptOperationVersion: 1 },
    },
    { runValidators: true, session, timestamps: false },
  ).exec();

  return result.matchedCount === 1;
}

export async function findExamGradingRecordById(
  examId: string,
): Promise<ExamGradingPersistenceRecord | null> {
  await prepareExamModel();

  const exam = await ExamModel.findById(examId)
    .select({
      title: 1,
      answerKey: 1,
      "settings.showScoreAfterSubmission": 1,
      "settings.showAnswersAfterSubmission": 1,
    })
    .lean<ExamGradingDocumentData>()
    .exec();

  return exam ? toExamGradingRecord(exam) : null;
}

export async function findExamReportingRecordById(
  examId: string,
): Promise<ExamReportingPersistenceRecord | null> {
  await prepareExamModel();

  const exam = await ExamModel.findById(examId)
    .select({
      title: 1,
      status: 1,
      answerKey: 1,
      settings: 1,
    })
    .lean<ExamReportingDocumentData>()
    .exec();

  return exam ? toExamReportingRecord(exam) : null;
}

export async function findExamReportingRecordsByIds(
  examIds: string[],
): Promise<ExamReportingPersistenceRecord[]> {
  await prepareExamModel();

  if (examIds.length === 0) {
    return [];
  }

  const exams = await ExamModel.find({ _id: { $in: examIds } })
    .select({
      title: 1,
      status: 1,
      answerKey: 1,
      settings: 1,
    })
    .lean<ExamReportingDocumentData[]>()
    .exec();

  return exams.map(toExamReportingRecord);
}

export async function countExamRecords(): Promise<{
  total: number;
  published: number;
}> {
  await prepareExamModel();
  const [total, published] = await Promise.all([
    ExamModel.countDocuments().exec(),
    ExamModel.countDocuments({ status: EXAM_STATUS.PUBLISHED }).exec(),
  ]);

  return { total, published };
}

export async function findExamRecordByPdfPublicId(
  publicId: string,
): Promise<ExamPersistenceRecord | null> {
  await prepareExamModel();

  const exam = await ExamModel.findOne({ "pdf.publicId": publicId })
    .lean<ExamDocumentData>()
    .exec();

  return exam ? toExamRecord(exam) : null;
}

export async function createExamRecord(
  input: SaveExamRecordInput,
  createdBy: string,
): Promise<ExamPersistenceRecord> {
  await prepareExamModel();

  const exam = await ExamModel.create({ ...input, createdBy });
  return toExamRecord(exam.toObject() as ExamDocumentData);
}

export async function updateExamRecord(
  examId: string,
  input: SaveExamRecordInput,
  expectedUpdatedAt: Date,
): Promise<ExamPersistenceRecord | null> {
  await prepareExamModel();

  const { description, ...requiredFields } = input;
  const update =
    description === undefined
      ? { $set: requiredFields, $unset: { description: 1 } }
      : { $set: input };

  const exam = await ExamModel.findOneAndUpdate(
    {
      _id: examId,
      updatedAt: expectedUpdatedAt,
      attemptsStarted: { $ne: true },
    },
    update,
    { returnDocument: "after", runValidators: true },
  )
    .lean<ExamDocumentData>()
    .exec();

  return exam ? toExamRecord(exam) : null;
}

export async function updateExamMetadataRecord(
  examId: string,
  input: UpdateExamMetadataRecordInput,
  expectedUpdatedAt: Date,
): Promise<ExamPersistenceRecord | null> {
  await prepareExamModel();

  const { description, ...requiredFields } = input;
  const update =
    description === undefined
      ? { $set: requiredFields, $unset: { description: 1 } }
      : { $set: input };

  const exam = await ExamModel.findOneAndUpdate(
    { _id: examId, updatedAt: expectedUpdatedAt },
    update,
    { returnDocument: "after", runValidators: true },
  )
    .lean<ExamDocumentData>()
    .exec();

  return exam ? toExamRecord(exam) : null;
}

export async function updateExamRecordStatus(
  examId: string,
  status: ExamStatus,
  expectedUpdatedAt: Date,
): Promise<ExamPersistenceRecord | null> {
  await prepareExamModel();

  const exam = await ExamModel.findOneAndUpdate(
    { _id: examId, updatedAt: expectedUpdatedAt },
    { $set: { status } },
    { returnDocument: "after", runValidators: true },
  )
    .lean<ExamDocumentData>()
    .exec();

  return exam ? toExamRecord(exam) : null;
}

export async function deleteExamRecord(
  examId: string,
  expectedUpdatedAt: Date,
  session: ClientSession,
): Promise<ExamPersistenceRecord | null> {
  await prepareExamModel();

  const exam = await ExamModel.findOneAndDelete(
    { _id: examId, updatedAt: expectedUpdatedAt },
    { session },
  )
    .lean<ExamDocumentData>()
    .exec();

  return exam ? toExamRecord(exam) : null;
}
