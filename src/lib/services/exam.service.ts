import "server-only";

import { deleteExamPdf, uploadExamPdf } from "@/lib/cloudinary/exam-pdf";
import { EXAM_STATUS } from "@/lib/constants/exam";
import { USER_ROLE } from "@/lib/constants/roles";
import {
  createExamRecord,
  deleteExamRecord,
  findExamRecordById,
  listExamRecords,
  updateExamRecord,
  updateExamRecordStatus,
  type ExamPersistenceRecord,
} from "@/lib/db/dao/exam.dao";
import {
  ExamConflictError,
  ExamNotFoundError,
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
  ExamStatus,
  ExamSummary,
} from "@/types/exam";
import type { AppUser } from "@/types/user";

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

export async function createExam(
  actor: AppUser,
  input: UpsertExamInput,
  pdfFile: File,
): Promise<ExamDetail> {
  assertAdmin(actor);

  if (input.status === EXAM_STATUS.PUBLISHED) {
    assertPublishableContent(input);
  }

  const pdf = await uploadExamPdf(pdfFile);

  try {
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
    await deletePdfBestEffort(pdf.publicId);
    throw error;
  }
}

export async function editExam(
  actor: AppUser,
  examId: string,
  input: UpdateExamInput,
  replacementPdf?: File,
): Promise<ExamDetail> {
  assertAdmin(actor);
  const currentExam = await findExamRecordById(examId);

  if (!currentExam) {
    throw new ExamNotFoundError();
  }

  if (currentExam.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    throw new ExamConflictError();
  }

  const examInput: UpsertExamInput = {
    title: input.title,
    description: input.description,
    status: input.status,
    settings: input.settings,
    answerKey: input.answerKey,
  };

  if (examInput.status === EXAM_STATUS.PUBLISHED) {
    assertPublishableContent(examInput);
  }

  const newPdf = replacementPdf
    ? await uploadExamPdf(replacementPdf)
    : currentExam.pdf;

  try {
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

    if (replacementPdf && currentExam.pdf.publicId !== newPdf.publicId) {
      await deletePdfBestEffort(currentExam.pdf.publicId);
    }

    return toExamDetail(updatedExam);
  } catch (error) {
    if (replacementPdf) {
      await deletePdfBestEffort(newPdf.publicId);
    }

    throw error;
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

  const deletedExam = await deleteExamRecord(examId, currentExam.updatedAt);

  if (!deletedExam) {
    throw new ExamConflictError();
  }

  await deletePdfBestEffort(deletedExam.pdf.publicId);
}
