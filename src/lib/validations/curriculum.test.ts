import { describe, expect, it } from "vitest";

import {
  createChapterSchema,
  createGradeSchema,
  updateChapterSchema,
} from "@/lib/validations/curriculum";
import { createTopicSchema, updateTopicSchema } from "@/lib/validations/topic";

const gradeId = "64b000000000000000000001";
const chapterId = "64b000000000000000000011";
const timestamp = "2026-09-01T00:00:00.000Z";

describe("curriculum validation", () => {
  it("accepts dynamic Grade labels and integer display order", () => {
    expect(
      createGradeSchema.parse({ name: "  Khối   6 ", sortOrder: 60 }),
    ).toEqual({ name: "Khối 6", sortOrder: 60 });
    expect(
      createGradeSchema.parse({ name: "Lớp bổ túc", sortOrder: -1 }),
    ).toEqual({ name: "Lớp bổ túc", sortOrder: -1 });
  });

  it("rejects a non-integer Grade sort order", () => {
    expect(
      createGradeSchema.safeParse({ name: "Khối 10", sortOrder: 10.5 }).success,
    ).toBe(false);
  });

  it("cleans Chapter names and supports moving to another Grade", () => {
    expect(createChapterSchema.parse({ gradeId, name: "  Hàm   số " })).toEqual(
      { gradeId, name: "Hàm số" },
    );
    expect(
      updateChapterSchema.parse({
        gradeId,
        name: "Xác suất",
        expectedUpdatedAt: timestamp,
      }),
    ).toMatchObject({ gradeId, name: "Xác suất" });
  });

  it("requires a valid Chapter for every new or edited Topic", () => {
    expect(createTopicSchema.safeParse({ name: "Hàm số" }).success).toBe(false);
    expect(
      createTopicSchema.parse({ chapterId, name: "  Hàm số bậc hai " }),
    ).toEqual({ chapterId, name: "Hàm số bậc hai" });
    expect(
      updateTopicSchema.safeParse({
        name: "Chủ đề cũ",
        expectedUpdatedAt: timestamp,
      }).success,
    ).toBe(false);
  });
});
