import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTopicRecord: vi.fn(),
  findTopicRecordByNormalizedName: vi.fn(),
  listTopicRecords: vi.fn(),
}));

vi.mock("@/lib/db/dao/topic.dao", () => ({
  createTopicRecord: mocks.createTopicRecord,
  findTopicRecordByNormalizedName: mocks.findTopicRecordByNormalizedName,
  listTopicRecords: mocks.listTopicRecords,
}));

import { USER_ROLE } from "@/lib/constants/roles";
import { createTopic } from "@/lib/services/topic.service";
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

const createdAt = new Date("2026-09-01T00:00:00.000Z");
const updatedAt = new Date("2026-09-01T00:00:00.000Z");

describe("topic service", () => {
  beforeEach(() => {
    mocks.createTopicRecord.mockReset();
    mocks.findTopicRecordByNormalizedName.mockReset();
    mocks.listTopicRecords.mockReset();
  });

  it("allows an ADMIN to create a normalized topic", async () => {
    mocks.createTopicRecord.mockResolvedValue({
      id: "64b000000000000000000011",
      name: "Nguyên hàm - Tích phân",
      normalizedName: "nguyên hàm - tích phân",
      createdAt,
      updatedAt,
    });

    const result = await createTopic(admin, {
      name: "  Nguyên hàm   - Tích phân  ",
    });

    expect(mocks.createTopicRecord).toHaveBeenCalledWith({
      name: "Nguyên hàm - Tích phân",
      normalizedName: "nguyên hàm - tích phân",
    });
    expect(result).toEqual({
      created: true,
      topic: {
        id: "64b000000000000000000011",
        name: "Nguyên hàm - Tích phân",
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    });
  });

  it("reuses the winning topic after a normalized-name race", async () => {
    const existingTopic = {
      id: "64b000000000000000000012",
      name: "Hàm số",
      normalizedName: "hàm số",
      createdAt,
      updatedAt,
    };
    mocks.createTopicRecord.mockRejectedValue({ code: 11000 });
    mocks.findTopicRecordByNormalizedName.mockResolvedValue(existingTopic);

    const result = await createTopic(admin, { name: " HÀM   SỐ " });

    expect(mocks.createTopicRecord).toHaveBeenCalledWith({
      name: "HÀM SỐ",
      normalizedName: "hàm số",
    });
    expect(mocks.findTopicRecordByNormalizedName).toHaveBeenCalledWith(
      "hàm số",
    );
    expect(result).toMatchObject({
      created: false,
      topic: { id: existingTopic.id, name: existingTopic.name },
    });
  });

  it("rejects topic creation from a non-ADMIN", async () => {
    await expect(
      createTopic(student, { name: "Số phức" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    expect(mocks.createTopicRecord).not.toHaveBeenCalled();
  });
});
