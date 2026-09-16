import "server-only";

import { USER_ROLE } from "@/lib/constants/roles";
import {
  createChapterRecord,
  deleteChapterRecord,
  findChapterRecordById,
  hasChapterRecordsForGrade,
  listChapterRecords,
  reserveChapterRecord,
  updateChapterRecord,
  type ChapterPersistenceRecord,
} from "@/lib/db/dao/chapter.dao";
import {
  createGradeRecord,
  deleteGradeRecord,
  findGradeRecordById,
  listGradeRecords,
  reserveGradeRecord,
  updateGradeRecord,
  type GradePersistenceRecord,
} from "@/lib/db/dao/grade.dao";
import { hasTopicRecordsForChapter } from "@/lib/db/dao/topic.dao";
import { isMongoDuplicateKeyError } from "@/lib/db/errors";
import { withMongoTransaction } from "@/lib/db/mongoose";
import {
  ChapterNotEmptyError,
  ChapterNotFoundError,
  CurriculumConflictError,
  CurriculumNameConflictError,
  ForbiddenError,
  GradeNotEmptyError,
  GradeNotFoundError,
} from "@/lib/errors/app-error";
import {
  cleanCurriculumName,
  normalizeCurriculumName,
} from "@/lib/utils/topic-name";
import {
  createChapterSchema,
  createGradeSchema,
  deleteChapterSchema,
  deleteGradeSchema,
  updateChapterSchema,
  updateGradeSchema,
  type CreateChapterInput,
  type CreateGradeInput,
  type DeleteChapterInput,
  type DeleteGradeInput,
  type UpdateChapterInput,
  type UpdateGradeInput,
} from "@/lib/validations/curriculum";
import type { Chapter, Grade } from "@/types/curriculum";
import type { AppUser } from "@/types/user";

function assertAdmin(actor: AppUser): void {
  if (actor.role !== USER_ROLE.ADMIN) {
    throw new ForbiddenError();
  }
}

function toGrade(grade: GradePersistenceRecord): Grade {
  return {
    id: grade.id,
    name: grade.name,
    sortOrder: grade.sortOrder,
    createdAt: grade.createdAt.toISOString(),
    updatedAt: grade.updatedAt.toISOString(),
  };
}

function toChapter(chapter: ChapterPersistenceRecord): Chapter {
  return {
    id: chapter.id,
    gradeId: chapter.gradeId,
    name: chapter.name,
    createdAt: chapter.createdAt.toISOString(),
    updatedAt: chapter.updatedAt.toISOString(),
  };
}

function assertCurrentTimestamp(
  updatedAt: Date,
  expectedUpdatedAt: string,
  resource: "khối" | "chương",
): void {
  if (updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new CurriculumConflictError(resource);
  }
}

export async function listGrades(actor: AppUser): Promise<Grade[]> {
  assertAdmin(actor);
  return (await listGradeRecords()).map(toGrade);
}

export async function createGrade(
  actor: AppUser,
  input: CreateGradeInput,
): Promise<Grade> {
  assertAdmin(actor);
  const validatedInput = createGradeSchema.parse(input);
  const name = cleanCurriculumName(validatedInput.name);

  try {
    return toGrade(
      await createGradeRecord({
        name,
        normalizedName: normalizeCurriculumName(name),
        sortOrder: validatedInput.sortOrder,
      }),
    );
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw new CurriculumNameConflictError("khối");
    }
    throw error;
  }
}

export async function editGrade(
  actor: AppUser,
  gradeId: string,
  input: UpdateGradeInput,
): Promise<Grade> {
  assertAdmin(actor);
  const validatedInput = updateGradeSchema.parse(input);
  const currentGrade = await findGradeRecordById(gradeId);

  if (!currentGrade) {
    throw new GradeNotFoundError();
  }

  assertCurrentTimestamp(
    currentGrade.updatedAt,
    validatedInput.expectedUpdatedAt,
    "khối",
  );
  const name = cleanCurriculumName(validatedInput.name);

  try {
    const grade = await updateGradeRecord(
      gradeId,
      {
        name,
        normalizedName: normalizeCurriculumName(name),
        sortOrder: validatedInput.sortOrder,
      },
      currentGrade.updatedAt,
    );

    if (!grade) {
      throw new CurriculumConflictError("khối");
    }
    return toGrade(grade);
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw new CurriculumNameConflictError("khối");
    }
    throw error;
  }
}

export async function deleteGrade(
  actor: AppUser,
  gradeId: string,
  input: DeleteGradeInput,
): Promise<void> {
  assertAdmin(actor);
  const validatedInput = deleteGradeSchema.parse(input);
  const currentGrade = await findGradeRecordById(gradeId);

  if (!currentGrade) {
    throw new GradeNotFoundError();
  }

  assertCurrentTimestamp(
    currentGrade.updatedAt,
    validatedInput.expectedUpdatedAt,
    "khối",
  );
  await withMongoTransaction(async (session) => {
    if (await hasChapterRecordsForGrade(gradeId, session)) {
      throw new GradeNotEmptyError();
    }
    if (!(await deleteGradeRecord(gradeId, currentGrade.updatedAt, session))) {
      throw new CurriculumConflictError("khối");
    }
  });
}

export async function listChapters(
  actor: AppUser,
  gradeId?: string,
): Promise<Chapter[]> {
  assertAdmin(actor);
  return (await listChapterRecords(gradeId)).map(toChapter);
}

export async function createChapter(
  actor: AppUser,
  input: CreateChapterInput,
): Promise<Chapter> {
  assertAdmin(actor);
  const validatedInput = createChapterSchema.parse(input);

  if (!(await findGradeRecordById(validatedInput.gradeId))) {
    throw new GradeNotFoundError();
  }

  const name = cleanCurriculumName(validatedInput.name);
  try {
    return await withMongoTransaction(async (session) => {
      if (!(await reserveGradeRecord(validatedInput.gradeId, session))) {
        throw new GradeNotFoundError();
      }
      return toChapter(
        await createChapterRecord(
          {
            gradeId: validatedInput.gradeId,
            name,
            normalizedName: normalizeCurriculumName(name),
          },
          session,
        ),
      );
    });
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw new CurriculumNameConflictError("chương");
    }
    throw error;
  }
}

export async function editChapter(
  actor: AppUser,
  chapterId: string,
  input: UpdateChapterInput,
): Promise<Chapter> {
  assertAdmin(actor);
  const validatedInput = updateChapterSchema.parse(input);
  const [currentChapter, destinationGrade] = await Promise.all([
    findChapterRecordById(chapterId),
    findGradeRecordById(validatedInput.gradeId),
  ]);

  if (!currentChapter) {
    throw new ChapterNotFoundError();
  }
  if (!destinationGrade) {
    throw new GradeNotFoundError();
  }

  assertCurrentTimestamp(
    currentChapter.updatedAt,
    validatedInput.expectedUpdatedAt,
    "chương",
  );
  const name = cleanCurriculumName(validatedInput.name);

  try {
    const chapter = await withMongoTransaction(async (session) => {
      if (!(await reserveGradeRecord(validatedInput.gradeId, session))) {
        throw new GradeNotFoundError();
      }
      const updatedChapter = await updateChapterRecord(
        chapterId,
        {
          gradeId: validatedInput.gradeId,
          name,
          normalizedName: normalizeCurriculumName(name),
        },
        currentChapter.updatedAt,
        session,
      );
      if (!updatedChapter) {
        throw new CurriculumConflictError("chương");
      }
      return updatedChapter;
    });
    return toChapter(chapter);
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw new CurriculumNameConflictError("chương");
    }
    throw error;
  }
}

export async function deleteChapter(
  actor: AppUser,
  chapterId: string,
  input: DeleteChapterInput,
): Promise<void> {
  assertAdmin(actor);
  const validatedInput = deleteChapterSchema.parse(input);
  const currentChapter = await findChapterRecordById(chapterId);

  if (!currentChapter) {
    throw new ChapterNotFoundError();
  }

  assertCurrentTimestamp(
    currentChapter.updatedAt,
    validatedInput.expectedUpdatedAt,
    "chương",
  );
  await withMongoTransaction(async (session) => {
    if (!(await reserveChapterRecord(chapterId, session))) {
      throw new CurriculumConflictError("chương");
    }
    if (await hasTopicRecordsForChapter(chapterId, session)) {
      throw new ChapterNotEmptyError();
    }
    if (
      !(await deleteChapterRecord(chapterId, currentChapter.updatedAt, session))
    ) {
      throw new CurriculumConflictError("chương");
    }
  });
}
