import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTopicRecord: vi.fn(),
  createTopicRecords: vi.fn(),
  deleteTopicRecord: vi.fn(),
  deleteTopicRecords: vi.fn(),
  findExamReferencedTopicIds: vi.fn(),
  findChapterRecordById: vi.fn(),
  findTopicRecordByChapterAndNormalizedName: vi.fn(),
  findTopicRecordById: vi.fn(),
  findTopicRecordsByIds: vi.fn(),
  hasExamRecordsWithTopicId: vi.fn(),
  listTopicRecords: vi.fn(),
  listChapterRecords: vi.fn(),
  listGradeRecords: vi.fn(),
  reserveChapterRecord: vi.fn(),
  reserveChapterRecordsByIds: vi.fn(),
  reserveGradeRecordsByIds: vi.fn(),
  reserveTopicRecordsByIds: vi.fn(),
  updateTopicRecord: vi.fn(),
  transactionSession: { id: "transaction-session" },
  withMongoTransaction: vi.fn(),
}));

vi.mock("@/lib/db/dao/chapter.dao", () => ({
  findChapterRecordById: mocks.findChapterRecordById,
  listChapterRecords: mocks.listChapterRecords,
  reserveChapterRecord: mocks.reserveChapterRecord,
  reserveChapterRecordsByIds: mocks.reserveChapterRecordsByIds,
}));

vi.mock("@/lib/db/dao/grade.dao", () => ({
  listGradeRecords: mocks.listGradeRecords,
  reserveGradeRecordsByIds: mocks.reserveGradeRecordsByIds,
}));

vi.mock("@/lib/db/dao/exam.dao", () => ({
  findExamReferencedTopicIds: mocks.findExamReferencedTopicIds,
  hasExamRecordsWithTopicId: mocks.hasExamRecordsWithTopicId,
}));

vi.mock("@/lib/db/dao/topic.dao", () => ({
  createTopicRecord: mocks.createTopicRecord,
  createTopicRecords: mocks.createTopicRecords,
  deleteTopicRecord: mocks.deleteTopicRecord,
  deleteTopicRecords: mocks.deleteTopicRecords,
  findTopicRecordByChapterAndNormalizedName:
    mocks.findTopicRecordByChapterAndNormalizedName,
  findTopicRecordById: mocks.findTopicRecordById,
  findTopicRecordsByIds: mocks.findTopicRecordsByIds,
  listTopicRecords: mocks.listTopicRecords,
  reserveTopicRecordsByIds: mocks.reserveTopicRecordsByIds,
  updateTopicRecord: mocks.updateTopicRecord,
}));

vi.mock("@/lib/db/mongoose", () => ({
  withMongoTransaction: mocks.withMongoTransaction,
}));

import { USER_ROLE } from "@/lib/constants/roles";
import {
  bulkDeleteTopics,
  createTopic,
  deleteTopic,
  editTopic,
  importTopics,
  listTopics,
  previewTopicImport,
} from "@/lib/services/topic.service";
import type { TopicPersistenceRecord } from "@/lib/db/dao/topic.dao";
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
const chapterId = "64b000000000000000000021";
const otherChapterId = "64b000000000000000000022";
const gradeId = "64b000000000000000000031";
const topicId = "64b000000000000000000011";
const createdAt = new Date("2026-09-01T00:00:00.000Z");
const updatedAt = new Date("2026-09-01T00:00:00.000Z");

function createTopicRecordFixture(
  overrides: Partial<TopicPersistenceRecord> = {},
): TopicPersistenceRecord {
  return {
    id: topicId,
    chapterId,
    name: "Nguyên hàm - Tích phân",
    normalizedName: "nguyên hàm - tích phân",
    createdAt,
    updatedAt,
    ...overrides,
  };
}

describe("topic service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      if (typeof mock === "function" && "mockReset" in mock) {
        mock.mockReset();
      }
    }
    mocks.findChapterRecordById.mockResolvedValue({ id: chapterId });
    mocks.findTopicRecordById.mockResolvedValue(createTopicRecordFixture());
    mocks.hasExamRecordsWithTopicId.mockResolvedValue(false);
    mocks.findExamReferencedTopicIds.mockResolvedValue([]);
    mocks.deleteTopicRecord.mockResolvedValue(true);
    mocks.deleteTopicRecords.mockResolvedValue(1);
    mocks.reserveChapterRecord.mockResolvedValue(true);
    mocks.reserveChapterRecordsByIds.mockResolvedValue(1);
    mocks.reserveGradeRecordsByIds.mockResolvedValue(1);
    mocks.reserveTopicRecordsByIds.mockResolvedValue(1);
    mocks.listGradeRecords.mockResolvedValue([
      {
        id: gradeId,
        name: "Khối 12",
        normalizedName: "khối 12",
        sortOrder: 12,
        createdAt,
        updatedAt,
      },
    ]);
    mocks.listChapterRecords.mockResolvedValue([
      {
        id: chapterId,
        gradeId,
        name: "Hàm số",
        normalizedName: "hàm số",
        createdAt,
        updatedAt,
      },
    ]);
    mocks.listTopicRecords.mockResolvedValue([]);
    mocks.withMongoTransaction.mockImplementation(
      (operation: (session: unknown) => Promise<unknown>) =>
        operation(mocks.transactionSession),
    );
  });

  it("creates a normalized Topic under an existing Chapter", async () => {
    mocks.createTopicRecord.mockResolvedValue(createTopicRecordFixture());

    const result = await createTopic(admin, {
      chapterId,
      name: "  Nguyên hàm   - Tích phân  ",
    });

    expect(mocks.findChapterRecordById).toHaveBeenCalledWith(chapterId);
    expect(mocks.createTopicRecord).toHaveBeenCalledWith(
      {
        chapterId,
        name: "Nguyên hàm - Tích phân",
        normalizedName: "nguyên hàm - tích phân",
      },
      mocks.transactionSession,
    );
    expect(result).toMatchObject({
      created: true,
      topic: { id: topicId, chapterId, name: "Nguyên hàm - Tích phân" },
    });
  });

  it("requires an existing Chapter for a new Topic", async () => {
    mocks.findChapterRecordById.mockResolvedValue(null);

    await expect(
      createTopic(admin, { chapterId, name: "Số phức" }),
    ).rejects.toMatchObject({ code: "CHAPTER_NOT_FOUND", statusCode: 404 });
    expect(mocks.createTopicRecord).not.toHaveBeenCalled();
  });

  it("reuses only the duplicate Topic from the selected Chapter", async () => {
    const existingTopic = createTopicRecordFixture({
      name: "Hàm số",
      normalizedName: "hàm số",
    });
    mocks.createTopicRecord.mockRejectedValue({ code: 11000 });
    mocks.findTopicRecordByChapterAndNormalizedName.mockResolvedValue(
      existingTopic,
    );

    const result = await createTopic(admin, {
      chapterId,
      name: " HÀM   SỐ ",
    });

    expect(
      mocks.findTopicRecordByChapterAndNormalizedName,
    ).toHaveBeenCalledWith(chapterId, "hàm số");
    expect(result).toMatchObject({ created: false, topic: { id: topicId } });
  });

  it("allows the same Topic name in different Chapters", async () => {
    mocks.findChapterRecordById.mockImplementation((id: string) =>
      Promise.resolve({ id }),
    );
    mocks.createTopicRecord
      .mockResolvedValueOnce(createTopicRecordFixture())
      .mockResolvedValueOnce(
        createTopicRecordFixture({
          id: `${topicId.slice(0, -1)}2`,
          chapterId: otherChapterId,
        }),
      );

    const first = await createTopic(admin, { chapterId, name: "Hàm số" });
    const second = await createTopic(admin, {
      chapterId: otherChapterId,
      name: "Hàm số",
    });

    expect(first.topic.id).not.toBe(second.topic.id);
    expect(mocks.createTopicRecord).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ chapterId: otherChapterId }),
      mocks.transactionSession,
    );
  });

  it("keeps a legacy Topic valid and lists it without a Chapter", async () => {
    mocks.listTopicRecords.mockResolvedValue([
      createTopicRecordFixture({ chapterId: undefined }),
    ]);

    await expect(listTopics(admin)).resolves.toEqual([
      {
        id: topicId,
        name: "Nguyên hàm - Tích phân",
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    ]);
  });

  it("assigns and renames a legacy Topic without changing its ID", async () => {
    mocks.findTopicRecordById.mockResolvedValue(
      createTopicRecordFixture({ chapterId: undefined }),
    );
    mocks.findChapterRecordById.mockResolvedValue({ id: otherChapterId });
    mocks.updateTopicRecord.mockResolvedValue(
      createTopicRecordFixture({
        chapterId: otherChapterId,
        name: "Tích phân",
        normalizedName: "tích phân",
      }),
    );

    const result = await editTopic(admin, topicId, {
      chapterId: otherChapterId,
      name: " Tích phân ",
      expectedUpdatedAt: updatedAt.toISOString(),
    });

    expect(result).toMatchObject({ id: topicId, chapterId: otherChapterId });
    expect(mocks.updateTopicRecord).toHaveBeenCalledWith(
      topicId,
      {
        chapterId: otherChapterId,
        name: "Tích phân",
        normalizedName: "tích phân",
      },
      updatedAt,
      mocks.transactionSession,
    );
    expect(mocks.hasExamRecordsWithTopicId).not.toHaveBeenCalled();
  });

  it("moves a categorized Topic while preserving its ID", async () => {
    mocks.findChapterRecordById.mockResolvedValue({ id: otherChapterId });
    mocks.updateTopicRecord.mockResolvedValue(
      createTopicRecordFixture({ chapterId: otherChapterId }),
    );

    const result = await editTopic(admin, topicId, {
      chapterId: otherChapterId,
      name: "Nguyên hàm - Tích phân",
      expectedUpdatedAt: updatedAt.toISOString(),
    });

    expect(result.id).toBe(topicId);
    expect(result.chapterId).toBe(otherChapterId);
  });

  it("rejects deletion when an Exam references the Topic", async () => {
    mocks.hasExamRecordsWithTopicId.mockResolvedValue(true);

    await expect(
      deleteTopic(admin, topicId, {
        expectedUpdatedAt: updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({
      code: "TOPIC_IN_USE",
      message: "Không thể xóa chủ đề vì chủ đề đang được sử dụng trong đề thi.",
    });
    expect(mocks.deleteTopicRecord).not.toHaveBeenCalled();
  });

  it("deletes an unused Topic", async () => {
    await deleteTopic(admin, topicId, {
      expectedUpdatedAt: updatedAt.toISOString(),
    });

    expect(mocks.deleteTopicRecord).toHaveBeenCalledWith(
      topicId,
      updatedAt,
      mocks.transactionSession,
    );
  });

  it("deletes a deduplicated Topic batch atomically", async () => {
    const topic = createTopicRecordFixture();
    mocks.findTopicRecordsByIds.mockResolvedValue([topic]);

    await expect(
      bulkDeleteTopics(admin, {
        topics: [
          { id: topicId, expectedUpdatedAt: updatedAt.toISOString() },
          { id: topicId, expectedUpdatedAt: updatedAt.toISOString() },
        ],
      }),
    ).resolves.toEqual({ deletedCount: 1 });

    expect(mocks.reserveTopicRecordsByIds).toHaveBeenCalledWith(
      [topicId],
      mocks.transactionSession,
    );
    expect(mocks.deleteTopicRecords).toHaveBeenCalledWith(
      [{ id: topicId, expectedUpdatedAt: updatedAt }],
      mocks.transactionSession,
    );
  });

  it("blocks the entire Topic batch and names Exam references", async () => {
    const secondTopicId = `${topicId.slice(0, -1)}2`;
    const topics = [
      createTopicRecordFixture(),
      createTopicRecordFixture({
        id: secondTopicId,
        name: "Số phức",
        normalizedName: "số phức",
      }),
    ];
    mocks.reserveTopicRecordsByIds.mockResolvedValue(2);
    mocks.findTopicRecordsByIds.mockResolvedValue(topics);
    mocks.findExamReferencedTopicIds.mockResolvedValue([secondTopicId]);

    await expect(
      bulkDeleteTopics(admin, {
        topics: topics.map((topic) => ({
          id: topic.id,
          expectedUpdatedAt: topic.updatedAt.toISOString(),
        })),
      }),
    ).rejects.toMatchObject({
      code: "TOPIC_IN_USE",
      message: expect.stringContaining("Số phức"),
    });
    expect(mocks.deleteTopicRecords).not.toHaveBeenCalled();
  });

  it("blocks the entire Topic batch when one timestamp is stale", async () => {
    mocks.findTopicRecordsByIds.mockResolvedValue([
      createTopicRecordFixture({ name: "Hàm số" }),
    ]);

    await expect(
      bulkDeleteTopics(admin, {
        topics: [
          {
            id: topicId,
            expectedUpdatedAt: new Date(
              "2026-08-01T00:00:00.000Z",
            ).toISOString(),
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "CURRICULUM_CONFLICT",
      message: expect.stringContaining("Hàm số"),
    });
    expect(mocks.deleteTopicRecords).not.toHaveBeenCalled();
  });

  it("previews new, existing, and invalid import items without writes", async () => {
    mocks.listTopicRecords.mockResolvedValue([
      createTopicRecordFixture({
        name: "Đạo hàm",
        normalizedName: "đạo hàm",
      }),
    ]);

    const preview = await previewTopicImport(admin, {
      groups: [
        {
          grade: " Khối 12 ",
          chapter: "Hàm số",
          topics: ["Đạo hàm", "Cực trị", "CỰC   TRỊ"],
        },
      ],
    });

    expect(preview.summary).toEqual({
      totalCount: 3,
      createCount: 1,
      skippedCount: 1,
      errorCount: 1,
    });
    expect(preview.items[2]).toMatchObject({
      status: "ERROR",
      message: expect.stringContaining("bị lặp"),
    });
    expect(mocks.createTopicRecords).not.toHaveBeenCalled();
    expect(mocks.withMongoTransaction).not.toHaveBeenCalled();
  });

  it("reports an import hierarchy error with its Grade and Chapter", async () => {
    const preview = await previewTopicImport(admin, {
      groups: [
        {
          grade: "Khối 11",
          chapter: "Lượng giác",
          topics: ["Công thức lượng giác"],
        },
      ],
    });

    expect(preview.canImport).toBe(false);
    expect(preview.items[0]).toMatchObject({
      grade: "Khối 11",
      chapter: "Lượng giác",
      status: "ERROR",
      message: expect.stringContaining("Không tìm thấy khối"),
    });
  });

  it("revalidates and creates every import Topic in one transaction", async () => {
    mocks.createTopicRecords.mockResolvedValue([]);

    await expect(
      importTopics(admin, {
        groups: [
          {
            grade: "Khối 12",
            chapter: "Hàm số",
            topics: ["Cực trị", "Tiệm cận"],
          },
        ],
      }),
    ).resolves.toEqual({ createdCount: 2, skippedCount: 0 });

    expect(mocks.listGradeRecords).toHaveBeenCalledWith(
      mocks.transactionSession,
    );
    expect(mocks.reserveGradeRecordsByIds).toHaveBeenCalledWith(
      [gradeId],
      mocks.transactionSession,
    );
    expect(mocks.reserveChapterRecordsByIds).toHaveBeenCalledWith(
      [chapterId],
      mocks.transactionSession,
    );
    expect(mocks.createTopicRecords).toHaveBeenCalledWith(
      [
        {
          chapterId,
          name: "Cực trị",
          normalizedName: "cực trị",
        },
        {
          chapterId,
          name: "Tiệm cận",
          normalizedName: "tiệm cận",
        },
      ],
      mocks.transactionSession,
    );
  });

  it("turns a concurrent import duplicate into an atomic conflict", async () => {
    mocks.createTopicRecords.mockRejectedValue({ code: 11000 });

    await expect(
      importTopics(admin, {
        groups: [
          {
            grade: "Khối 12",
            chapter: "Hàm số",
            topics: ["Cực trị"],
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "TOPIC_IMPORT_CONFLICT",
      statusCode: 409,
    });
  });

  it("denies every Topic operation to non-ADMIN users", async () => {
    await expect(listTopics(student)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      createTopic(student, { chapterId, name: "Số phức" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      editTopic(student, topicId, {
        chapterId,
        name: "Số phức",
        expectedUpdatedAt: updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      deleteTopic(student, topicId, {
        expectedUpdatedAt: updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      bulkDeleteTopics(student, {
        topics: [{ id: topicId, expectedUpdatedAt: updatedAt.toISOString() }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      previewTopicImport(student, {
        groups: [{ grade: "Khối 12", chapter: "Hàm số", topics: ["Cực trị"] }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.findChapterRecordById).not.toHaveBeenCalled();
    expect(mocks.findTopicRecordById).not.toHaveBeenCalled();
  });
});
