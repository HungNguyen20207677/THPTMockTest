import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createChapterRecord: vi.fn(),
  createGradeRecord: vi.fn(),
  deleteChapterRecord: vi.fn(),
  deleteGradeRecord: vi.fn(),
  findChapterRecordById: vi.fn(),
  findGradeRecordById: vi.fn(),
  hasChapterRecordsForGrade: vi.fn(),
  hasTopicRecordsForChapter: vi.fn(),
  listChapterRecords: vi.fn(),
  listGradeRecords: vi.fn(),
  reserveChapterRecord: vi.fn(),
  reserveGradeRecord: vi.fn(),
  updateChapterRecord: vi.fn(),
  updateGradeRecord: vi.fn(),
  transactionSession: { id: "transaction-session" },
  withMongoTransaction: vi.fn(),
}));

vi.mock("@/lib/db/dao/chapter.dao", () => ({
  createChapterRecord: mocks.createChapterRecord,
  deleteChapterRecord: mocks.deleteChapterRecord,
  findChapterRecordById: mocks.findChapterRecordById,
  hasChapterRecordsForGrade: mocks.hasChapterRecordsForGrade,
  listChapterRecords: mocks.listChapterRecords,
  reserveChapterRecord: mocks.reserveChapterRecord,
  updateChapterRecord: mocks.updateChapterRecord,
}));

vi.mock("@/lib/db/dao/grade.dao", () => ({
  createGradeRecord: mocks.createGradeRecord,
  deleteGradeRecord: mocks.deleteGradeRecord,
  findGradeRecordById: mocks.findGradeRecordById,
  listGradeRecords: mocks.listGradeRecords,
  reserveGradeRecord: mocks.reserveGradeRecord,
  updateGradeRecord: mocks.updateGradeRecord,
}));

vi.mock("@/lib/db/dao/topic.dao", () => ({
  hasTopicRecordsForChapter: mocks.hasTopicRecordsForChapter,
}));

vi.mock("@/lib/db/mongoose", () => ({
  withMongoTransaction: mocks.withMongoTransaction,
}));

import { USER_ROLE } from "@/lib/constants/roles";
import type { ChapterPersistenceRecord } from "@/lib/db/dao/chapter.dao";
import type { GradePersistenceRecord } from "@/lib/db/dao/grade.dao";
import {
  createChapter,
  createGrade,
  deleteChapter,
  deleteGrade,
  editChapter,
  editGrade,
  listChapters,
  listGrades,
} from "@/lib/services/curriculum.service";
import type { AppUser } from "@/types/user";

const admin: AppUser = {
  id: "admin-id",
  username: "admin",
  fullName: "Quan Tri Vien",
  role: USER_ROLE.ADMIN,
};
const student: AppUser = {
  id: "student-id",
  username: "student",
  fullName: "Hoc Sinh",
  role: USER_ROLE.STUDENT,
};
const gradeId = "64b000000000000000000001";
const otherGradeId = "64b000000000000000000002";
const chapterId = "64b000000000000000000011";
const createdAt = new Date("2026-09-01T00:00:00.000Z");
const updatedAt = new Date("2026-09-02T00:00:00.000Z");

function gradeFixture(
  overrides: Partial<GradePersistenceRecord> = {},
): GradePersistenceRecord {
  return {
    id: gradeId,
    name: "Khối 10",
    normalizedName: "khối 10",
    sortOrder: 10,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function chapterFixture(
  overrides: Partial<ChapterPersistenceRecord> = {},
): ChapterPersistenceRecord {
  return {
    id: chapterId,
    gradeId,
    name: "Hàm số",
    normalizedName: "hàm số",
    createdAt,
    updatedAt,
    ...overrides,
  };
}

describe("curriculum service", () => {
  beforeEach(() => {
    mocks.createChapterRecord.mockReset();
    mocks.createGradeRecord.mockReset();
    mocks.deleteChapterRecord.mockReset();
    mocks.deleteGradeRecord.mockReset();
    mocks.findChapterRecordById.mockReset();
    mocks.findGradeRecordById.mockReset();
    mocks.hasChapterRecordsForGrade.mockReset();
    mocks.hasTopicRecordsForChapter.mockReset();
    mocks.listChapterRecords.mockReset();
    mocks.listGradeRecords.mockReset();
    mocks.reserveChapterRecord.mockReset();
    mocks.reserveGradeRecord.mockReset();
    mocks.updateChapterRecord.mockReset();
    mocks.updateGradeRecord.mockReset();
    mocks.withMongoTransaction.mockReset();

    mocks.findGradeRecordById.mockResolvedValue(gradeFixture());
    mocks.findChapterRecordById.mockResolvedValue(chapterFixture());
    mocks.hasChapterRecordsForGrade.mockResolvedValue(false);
    mocks.hasTopicRecordsForChapter.mockResolvedValue(false);
    mocks.deleteGradeRecord.mockResolvedValue(true);
    mocks.deleteChapterRecord.mockResolvedValue(true);
    mocks.reserveChapterRecord.mockResolvedValue(true);
    mocks.reserveGradeRecord.mockResolvedValue(true);
    mocks.withMongoTransaction.mockImplementation(
      (operation: (session: unknown) => Promise<unknown>) =>
        operation(mocks.transactionSession),
    );
  });

  it("creates a normalized Grade with a display sort order", async () => {
    mocks.createGradeRecord.mockResolvedValue(gradeFixture());

    const result = await createGrade(admin, {
      name: "  Khối   10 ",
      sortOrder: 10,
    });

    expect(mocks.createGradeRecord).toHaveBeenCalledWith({
      name: "Khối 10",
      normalizedName: "khối 10",
      sortOrder: 10,
    });
    expect(result).toMatchObject({ id: gradeId, sortOrder: 10 });
  });

  it("rejects a duplicate normalized Grade", async () => {
    mocks.createGradeRecord.mockRejectedValue({ code: 11000 });

    await expect(
      createGrade(admin, { name: "KHỐI 10", sortOrder: 20 }),
    ).rejects.toMatchObject({
      code: "CURRICULUM_NAME_EXISTS",
      statusCode: 409,
    });
  });

  it("renames and reorders a Grade without changing its ID", async () => {
    mocks.updateGradeRecord.mockResolvedValue(
      gradeFixture({ name: "Lớp 10", normalizedName: "lớp 10", sortOrder: 1 }),
    );

    const result = await editGrade(admin, gradeId, {
      name: " Lớp 10 ",
      sortOrder: 1,
      expectedUpdatedAt: updatedAt.toISOString(),
    });

    expect(result).toMatchObject({ id: gradeId, name: "Lớp 10", sortOrder: 1 });
  });

  it("rejects deleting a Grade that still contains Chapters", async () => {
    mocks.hasChapterRecordsForGrade.mockResolvedValue(true);

    await expect(
      deleteGrade(admin, gradeId, {
        expectedUpdatedAt: updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({
      code: "GRADE_NOT_EMPTY",
      message: "Không thể xóa khối vì vẫn còn chương.",
    });
    expect(mocks.deleteGradeRecord).not.toHaveBeenCalled();
  });

  it("deletes an empty Grade", async () => {
    await deleteGrade(admin, gradeId, {
      expectedUpdatedAt: updatedAt.toISOString(),
    });
    expect(mocks.deleteGradeRecord).toHaveBeenCalledWith(
      gradeId,
      updatedAt,
      mocks.transactionSession,
    );
  });

  it("requires an existing Grade when creating a Chapter", async () => {
    mocks.findGradeRecordById.mockResolvedValue(null);

    await expect(
      createChapter(admin, { gradeId, name: "Hàm số" }),
    ).rejects.toMatchObject({ code: "GRADE_NOT_FOUND", statusCode: 404 });
    expect(mocks.createChapterRecord).not.toHaveBeenCalled();
  });

  it("rejects duplicate Chapter names within one Grade", async () => {
    mocks.createChapterRecord.mockRejectedValue({ code: 11000 });

    await expect(
      createChapter(admin, { gradeId, name: "HÀM SỐ" }),
    ).rejects.toMatchObject({ code: "CURRICULUM_NAME_EXISTS" });
  });

  it("allows the same Chapter name in different Grades", async () => {
    mocks.findGradeRecordById.mockImplementation((id: string) =>
      Promise.resolve(gradeFixture({ id })),
    );
    mocks.createChapterRecord
      .mockResolvedValueOnce(chapterFixture())
      .mockResolvedValueOnce(
        chapterFixture({
          id: `${chapterId.slice(0, -1)}2`,
          gradeId: otherGradeId,
        }),
      );

    const first = await createChapter(admin, { gradeId, name: "Hàm số" });
    const second = await createChapter(admin, {
      gradeId: otherGradeId,
      name: "Hàm số",
    });

    expect(first.id).not.toBe(second.id);
  });

  it("moves a Chapter while preserving its ID and Topics", async () => {
    mocks.findGradeRecordById.mockResolvedValue(
      gradeFixture({ id: otherGradeId }),
    );
    mocks.updateChapterRecord.mockResolvedValue(
      chapterFixture({ gradeId: otherGradeId }),
    );

    const result = await editChapter(admin, chapterId, {
      gradeId: otherGradeId,
      name: "Hàm số",
      expectedUpdatedAt: updatedAt.toISOString(),
    });

    expect(result).toMatchObject({ id: chapterId, gradeId: otherGradeId });
    expect(mocks.updateChapterRecord).toHaveBeenCalledWith(
      chapterId,
      expect.objectContaining({ gradeId: otherGradeId }),
      updatedAt,
      mocks.transactionSession,
    );
    expect(mocks.hasTopicRecordsForChapter).not.toHaveBeenCalled();
  });

  it("rejects deleting a Chapter that still contains Topics", async () => {
    mocks.hasTopicRecordsForChapter.mockResolvedValue(true);

    await expect(
      deleteChapter(admin, chapterId, {
        expectedUpdatedAt: updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({
      code: "CHAPTER_NOT_EMPTY",
      message: "Không thể xóa chương vì vẫn còn chủ đề.",
    });
    expect(mocks.deleteChapterRecord).not.toHaveBeenCalled();
  });

  it("deletes an empty Chapter", async () => {
    await deleteChapter(admin, chapterId, {
      expectedUpdatedAt: updatedAt.toISOString(),
    });
    expect(mocks.deleteChapterRecord).toHaveBeenCalledWith(
      chapterId,
      updatedAt,
      mocks.transactionSession,
    );
  });

  it("lists the hierarchy in fixed catalog queries", async () => {
    mocks.listGradeRecords.mockResolvedValue([gradeFixture()]);
    mocks.listChapterRecords.mockResolvedValue([chapterFixture()]);

    await expect(listGrades(admin)).resolves.toHaveLength(1);
    await expect(listChapters(admin)).resolves.toHaveLength(1);
    expect(mocks.listGradeRecords).toHaveBeenCalledOnce();
    expect(mocks.listChapterRecords).toHaveBeenCalledOnce();
  });

  it("denies Grade and Chapter management to non-ADMIN users", async () => {
    await expect(listGrades(student)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(listChapters(student)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      createGrade(student, { name: "Khối 10", sortOrder: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createChapter(student, { gradeId, name: "Hàm số" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listGradeRecords).not.toHaveBeenCalled();
    expect(mocks.listChapterRecords).not.toHaveBeenCalled();
  });
});
