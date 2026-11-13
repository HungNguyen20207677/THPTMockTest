import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteExam: vi.fn(),
  deleteStudent: vi.fn(),
  deleteExamStructureTemplate: vi.fn(),
}));

vi.mock("@/lib/services/exam.service", () => ({
  deleteExam: mocks.deleteExam,
}));
vi.mock("@/lib/services/student.service", () => ({
  deleteStudent: mocks.deleteStudent,
}));
vi.mock("@/lib/services/exam-structure-template.service", () => ({
  deleteExamStructureTemplate: mocks.deleteExamStructureTemplate,
}));

import { USER_ROLE } from "@/lib/constants/roles";
import {
  BuiltInExamStructureTemplateReadOnlyError,
  ExamConflictError,
  ForbiddenError,
} from "@/lib/errors/app-error";
import {
  bulkDeleteExams,
  bulkDeleteExamStructureTemplates,
  bulkDeleteStudents,
} from "@/lib/services/bulk-deletion.service";
import type { AppUser } from "@/types/user";

const admin: AppUser = {
  id: "64b000000000000000000099",
  username: "admin",
  fullName: "Admin",
  role: USER_ROLE.ADMIN,
};
const firstId = "64b000000000000000000001";
const secondId = "64b000000000000000000002";
const updatedAt = "2026-11-13T00:00:00.000Z";

describe("bulk deletion service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("preserves Student cascade cleanup results per record", async () => {
    mocks.deleteStudent
      .mockResolvedValueOnce({ cleanupWarning: null })
      .mockResolvedValueOnce({
        cleanupWarning: "Cloudinary cleanup incomplete",
      });

    const result = await bulkDeleteStudents(admin, {
      items: [{ id: firstId }, { id: secondId }],
    });

    expect(mocks.deleteStudent).toHaveBeenNthCalledWith(1, admin, firstId);
    expect(mocks.deleteStudent).toHaveBeenNthCalledWith(2, admin, secondId);
    expect(result).toMatchObject({
      deletedCount: 1,
      mediaCleanupIncompleteCount: 1,
      failedCount: 0,
      items: [
        { id: firstId, status: "DELETED" },
        {
          id: secondId,
          status: "MEDIA_CLEANUP_INCOMPLETE",
          message: "Cloudinary cleanup incomplete",
        },
      ],
    });
  });

  it("continues Exam deletion after a business rejection without retrying successes", async () => {
    mocks.deleteExam
      .mockResolvedValueOnce({ cleanupWarning: null })
      .mockRejectedValueOnce(new ExamConflictError());

    const result = await bulkDeleteExams(admin, {
      items: [
        { id: firstId, expectedUpdatedAt: updatedAt },
        { id: secondId, expectedUpdatedAt: updatedAt },
      ],
    });

    expect(mocks.deleteExam).toHaveBeenCalledTimes(2);
    expect(mocks.deleteExam).toHaveBeenNthCalledWith(
      1,
      admin,
      firstId,
      updatedAt,
    );
    expect(mocks.deleteExam).toHaveBeenNthCalledWith(
      2,
      admin,
      secondId,
      updatedAt,
    );
    expect(result.items).toEqual([
      { id: firstId, status: "DELETED" },
      expect.objectContaining({
        id: secondId,
        status: "REJECTED",
        code: "EXAM_CONFLICT",
      }),
    ]);
  });

  it("reports a protected built-in template without blocking another template", async () => {
    mocks.deleteExamStructureTemplate
      .mockRejectedValueOnce(new BuiltInExamStructureTemplateReadOnlyError())
      .mockResolvedValueOnce(undefined);

    const result = await bulkDeleteExamStructureTemplates(admin, {
      items: [
        { id: firstId, expectedUpdatedAt: updatedAt },
        { id: secondId, expectedUpdatedAt: updatedAt },
      ],
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: firstId,
        status: "REJECTED",
        code: "BUILT_IN_EXAM_STRUCTURE_TEMPLATE_READ_ONLY",
      }),
      { id: secondId, status: "DELETED" },
    ]);
  });

  it("classifies authorization rejection and never changes the target ID", async () => {
    mocks.deleteStudent.mockRejectedValue(new ForbiddenError());

    const result = await bulkDeleteStudents(admin, {
      items: [{ id: firstId }],
    });

    expect(mocks.deleteStudent).toHaveBeenCalledWith(admin, firstId);
    expect(result.items[0]).toMatchObject({
      id: firstId,
      status: "REJECTED",
      code: "FORBIDDEN",
    });
  });

  it("reports unexpected deletion failures and continues with later records", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.deleteExam
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce({ cleanupWarning: null });

    const result = await bulkDeleteExams(admin, {
      items: [
        { id: firstId, expectedUpdatedAt: updatedAt },
        { id: secondId, expectedUpdatedAt: updatedAt },
      ],
    });

    expect(result.items).toEqual([
      {
        id: firstId,
        status: "FAILED",
        message: "Không thể xóa bản ghi do lỗi hệ thống.",
      },
      { id: secondId, status: "DELETED" },
    ]);
  });

  it("rejects duplicate IDs before any destructive operation", async () => {
    await expect(
      bulkDeleteStudents(admin, {
        items: [{ id: firstId }, { id: firstId }],
      }),
    ).rejects.toThrow("Danh sách xóa chứa mã bản ghi trùng lặp");
    expect(mocks.deleteStudent).not.toHaveBeenCalled();
  });
});
