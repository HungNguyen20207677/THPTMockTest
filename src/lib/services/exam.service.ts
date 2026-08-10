import "server-only";

import {
  assertAuthenticExamPdfUploadReference,
  assertValidExamPdfUploadReference,
  createExamPdfUploadTicket,
  deleteExamPdf,
  discardExamPdfUpload,
  verifyExamPdfAsset,
} from "@/lib/cloudinary/exam-pdf";
import { EXAM_STATUS } from "@/lib/constants/exam";
import { USER_ROLE } from "@/lib/constants/roles";
import {
  acquireExamPdfOperationLease,
  createExamRecord,
  deleteExamRecord,
  findExamRecordById,
  findExamRecordByPdfPublicId,
  listExamRecords,
  releaseExamPdfOperationLease,
  updateExamRecord,
  updateExamRecordStatus,
  type ExamPdfOperationLease,
  type ExamPersistenceRecord,
} from "@/lib/db/dao/exam.dao";
import { isMongoDuplicateKeyError } from "@/lib/db/errors";
import {
  ExamConflictError,
  ExamNotFoundError,
  ExamPdfAlreadyAttachedError,
  ExamPdfOperationConflictError,
  ExamPublicationError,
  ForbiddenError,
} from "@/lib/errors/app-error";
import {
  examUpsertSchema,
  publishableExamSchema,
  type UpdateExamInput,
  type UpsertExamInput,
} from "@/lib/validations/exam";
import type {
  ExamDetail,
  ExamPdf,
  ExamPdfUploadReference,
  ExamPdfUploadTicket,
  ExamStatus,
  ExamSummary,
} from "@/types/exam";
import type { AppUser } from "@/types/user";
import type { ExamPdfUploadIntent } from "@/lib/validations/exam-pdf";

function assertAdmin(actor: AppUser): void {
  if (actor.role !== USER_ROLE.ADMIN) {
    throw new ForbiddenError();
  }
}

function toExamSummary(exam: ExamPersistenceRecord): ExamSummary {
  return {
    id: exam.id,
    title: exam.title,
    status: exam.status,
    settings: exam.settings,
    createdAt: exam.createdAt.toISOString(),
    updatedAt: exam.updatedAt.toISOString(),
  };
}

function toExamDetail(exam: ExamPersistenceRecord): ExamDetail {
  return {
    ...toExamSummary(exam),
    description: exam.description,
    pdf: exam.pdf,
    answerKey: exam.answerKey,
  };
}

function assertPublishableContent(input: UpsertExamInput): void {
  if (!examUpsertSchema.safeParse(input).success) {
    throw new ExamPublicationError();
  }
}

export function assertExamCanBePublished(input: {
  title: string;
  pdf: ExamPdf;
  answerKey: ExamPersistenceRecord["answerKey"];
}): void {
  const publicationData = {
    title: input.title,
    pdf: input.pdf,
    answerKey: input.answerKey,
  };

  if (!publishableExamSchema.safeParse(publicationData).success) {
    throw new ExamPublicationError();
  }
}

async function deletePdfBestEffort(publicId: string): Promise<void> {
  try {
    await deleteExamPdf(publicId);
  } catch (error) {
    console.error(`Could not delete Cloudinary PDF ${publicId}.`, error);
  }
}

async function assertPdfUploadIsUnclaimed(
  reference: ExamPdfUploadReference,
): Promise<void> {
  if (await findExamRecordByPdfPublicId(reference.publicId)) {
    throw new ExamPdfAlreadyAttachedError();
  }
}

async function acquirePdfOperationLeases(
  publicIds: string[],
): Promise<ExamPdfOperationLease[]> {
  const leases: ExamPdfOperationLease[] = [];

  try {
    for (const publicId of [...new Set(publicIds)].sort()) {
      const lease = await acquireExamPdfOperationLease(publicId);

      if (!lease) {
        throw new ExamPdfOperationConflictError();
      }

      leases.push(lease);
    }

    return leases;
  } catch (error) {
    await releasePdfOperationLeasesBestEffort(leases);
    throw error;
  }
}

async function acquirePdfUploadLeases(
  reference: ExamPdfUploadReference,
  additionalPublicIds: string[] = [],
): Promise<ExamPdfOperationLease[]> {
  assertAuthenticExamPdfUploadReference(reference);
  return acquirePdfOperationLeases([
    reference.publicId,
    ...additionalPublicIds,
  ]);
}

async function releasePdfOperationLeasesBestEffort(
  leases: ExamPdfOperationLease[],
): Promise<void> {
  for (const lease of [...leases].reverse()) {
    try {
      await releaseExamPdfOperationLease(lease);
    } catch {
      // The lease expires automatically if MongoDB cannot release it now.
    }
  }
}

async function discardPdfUploadWhileLeasedBestEffort(
  reference: ExamPdfUploadReference,
): Promise<void> {
  try {
    if (!(await findExamRecordByPdfPublicId(reference.publicId))) {
      await discardExamPdfUpload(reference);
    }
  } catch {
    // Cleanup must not replace the original validation or persistence error.
  }
}

export async function discardUnclaimedExamPdfUpload(
  reference: ExamPdfUploadReference,
): Promise<void> {
  assertAuthenticExamPdfUploadReference(reference);
  const leases = await acquirePdfOperationLeases([reference.publicId]);

  try {
    if (await findExamRecordByPdfPublicId(reference.publicId)) {
      return;
    }

    await discardExamPdfUpload(reference);
  } finally {
    await releasePdfOperationLeasesBestEffort(leases);
  }
}

async function discardPdfUploadBestEffort(
  reference: ExamPdfUploadReference,
): Promise<void> {
  try {
    await discardUnclaimedExamPdfUpload(reference);
  } catch {
    // Cleanup must not replace the original validation or persistence error.
  }
}

function normalizePdfOwnershipError(error: unknown): unknown {
  return isMongoDuplicateKeyError(error)
    ? new ExamPdfAlreadyAttachedError()
    : error;
}

export async function listExams(actor: AppUser): Promise<ExamSummary[]> {
  assertAdmin(actor);
  const exams = await listExamRecords();
  return exams.map(toExamSummary);
}

export async function getExam(
  actor: AppUser,
  examId: string,
): Promise<ExamDetail> {
  assertAdmin(actor);
  const exam = await findExamRecordById(examId);

  if (!exam) {
    throw new ExamNotFoundError();
  }

  return toExamDetail(exam);
}

export function issueExamPdfUploadTicket(
  actor: AppUser,
  intent: ExamPdfUploadIntent,
): ExamPdfUploadTicket {
  assertAdmin(actor);
  return createExamPdfUploadTicket(intent);
}

export async function createExam(
  actor: AppUser,
  input: UpsertExamInput,
  pdfUpload: ExamPdfUploadReference,
): Promise<ExamDetail> {
  assertAdmin(actor);
  const leases = await acquirePdfUploadLeases(pdfUpload);

  try {
    assertValidExamPdfUploadReference(pdfUpload);
    await assertPdfUploadIsUnclaimed(pdfUpload);
    const pdf = await verifyExamPdfAsset(pdfUpload);

    if (input.status === EXAM_STATUS.PUBLISHED) {
      assertExamCanBePublished({
        title: input.title,
        pdf,
        answerKey: input.answerKey,
      });
    }

    const exam = await createExamRecord({ ...input, pdf }, actor.id);
    return toExamDetail(exam);
  } catch (error) {
    await discardPdfUploadWhileLeasedBestEffort(pdfUpload);
    throw normalizePdfOwnershipError(error);
  } finally {
    await releasePdfOperationLeasesBestEffort(leases);
  }
}

export async function editExam(
  actor: AppUser,
  examId: string,
  input: UpdateExamInput,
  replacementPdfUpload?: ExamPdfUploadReference,
): Promise<ExamDetail> {
  assertAdmin(actor);
  const currentExam = await findExamRecordById(examId);

  if (!currentExam) {
    if (replacementPdfUpload) {
      await discardPdfUploadBestEffort(replacementPdfUpload);
    }

    throw new ExamNotFoundError();
  }

  const examInput: UpsertExamInput = {
    title: input.title,
    description: input.description,
    status: input.status,
    settings: input.settings,
    answerKey: input.answerKey,
  };
  const replacementLeases = replacementPdfUpload
    ? await acquirePdfUploadLeases(replacementPdfUpload, [
        currentExam.pdf.publicId,
      ])
    : [];

  try {
    if (currentExam.updatedAt.toISOString() !== input.expectedUpdatedAt) {
      throw new ExamConflictError();
    }

    if (examInput.status === EXAM_STATUS.PUBLISHED) {
      assertPublishableContent(examInput);
    }

    if (replacementPdfUpload) {
      assertValidExamPdfUploadReference(replacementPdfUpload);
      await assertPdfUploadIsUnclaimed(replacementPdfUpload);
    }

    const newPdf = replacementPdfUpload
      ? await verifyExamPdfAsset(replacementPdfUpload)
      : currentExam.pdf;

    if (examInput.status === EXAM_STATUS.PUBLISHED) {
      assertExamCanBePublished({
        title: examInput.title,
        pdf: newPdf,
        answerKey: examInput.answerKey,
      });
    }

    const updatedExam = await updateExamRecord(
      examId,
      { ...examInput, pdf: newPdf },
      currentExam.updatedAt,
    );

    if (!updatedExam) {
      throw new ExamConflictError();
    }

    if (replacementPdfUpload && currentExam.pdf.publicId !== newPdf.publicId) {
      await deletePdfBestEffort(currentExam.pdf.publicId);
    }

    return toExamDetail(updatedExam);
  } catch (error) {
    if (replacementPdfUpload) {
      await discardPdfUploadWhileLeasedBestEffort(replacementPdfUpload);
    }

    throw normalizePdfOwnershipError(error);
  } finally {
    await releasePdfOperationLeasesBestEffort(replacementLeases);
  }
}

export async function changeExamStatus(
  actor: AppUser,
  examId: string,
  status: ExamStatus,
  expectedUpdatedAt: string,
): Promise<ExamDetail> {
  assertAdmin(actor);
  const currentExam = await findExamRecordById(examId);

  if (!currentExam) {
    throw new ExamNotFoundError();
  }

  if (currentExam.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new ExamConflictError();
  }

  if (status === EXAM_STATUS.PUBLISHED) {
    assertExamCanBePublished(currentExam);
  }

  const updatedExam = await updateExamRecordStatus(
    examId,
    status,
    currentExam.updatedAt,
  );

  if (!updatedExam) {
    throw new ExamConflictError();
  }

  return toExamDetail(updatedExam);
}

export async function deleteExam(
  actor: AppUser,
  examId: string,
  expectedUpdatedAt: string,
): Promise<void> {
  assertAdmin(actor);
  const currentExam = await findExamRecordById(examId);

  if (!currentExam) {
    throw new ExamNotFoundError();
  }

  if (currentExam.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new ExamConflictError();
  }

  const leases = await acquirePdfOperationLeases([currentExam.pdf.publicId]);

  try {
    const deletedExam = await deleteExamRecord(examId, currentExam.updatedAt);

    if (!deletedExam) {
      throw new ExamConflictError();
    }

    await deletePdfBestEffort(deletedExam.pdf.publicId);
  } finally {
    await releasePdfOperationLeasesBestEffort(leases);
  }
}
