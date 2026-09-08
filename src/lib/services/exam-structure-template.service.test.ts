import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createExamStructureTemplateRecord: vi.fn(),
  deleteExamStructureTemplateRecord: vi.fn(),
  findExamStructureTemplateRecordById: vi.fn(),
  listExamStructureTemplateRecords: vi.fn(),
  updateExamStructureTemplateRecord: vi.fn(),
}));

vi.mock("@/lib/db/dao/exam-structure-template.dao", () => ({
  createExamStructureTemplateRecord: mocks.createExamStructureTemplateRecord,
  deleteExamStructureTemplateRecord: mocks.deleteExamStructureTemplateRecord,
  findExamStructureTemplateRecordById:
    mocks.findExamStructureTemplateRecordById,
  listExamStructureTemplateRecords: mocks.listExamStructureTemplateRecords,
  updateExamStructureTemplateRecord: mocks.updateExamStructureTemplateRecord,
}));

import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import { USER_ROLE } from "@/lib/constants/roles";
import type { ExamStructureTemplatePersistenceRecord } from "@/lib/db/dao/exam-structure-template.dao";
import {
  createExamStructureTemplate,
  deleteExamStructureTemplate,
  editExamStructureTemplate,
  listExamStructureTemplates,
} from "@/lib/services/exam-structure-template.service";
import type {
  UpdateExamStructureTemplateInput,
  UpsertExamStructureTemplateInput,
} from "@/lib/validations/exam-structure-template";
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

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const updatedAt = new Date("2026-01-02T00:00:00.000Z");

function createValidInput(): UpsertExamStructureTemplateInput {
  return {
    name: "Kiểm tra chương",
    sections: [
      {
        id: "section-1",
        title: "Phần I",
        questions: [
          {
            id: "question-1",
            type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
            maxScoreHundredths: 1000,
          },
        ],
      },
    ],
  };
}

function createStoredTemplate(
  overrides: Partial<ExamStructureTemplatePersistenceRecord> = {},
): ExamStructureTemplatePersistenceRecord {
  return {
    id: "507f1f77bcf86cd799439011",
    ...createValidInput(),
    isBuiltIn: false,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

describe("Exam structure template service", () => {
  beforeEach(() => {
    mocks.createExamStructureTemplateRecord.mockReset();
    mocks.deleteExamStructureTemplateRecord.mockReset();
    mocks.findExamStructureTemplateRecordById.mockReset();
    mocks.listExamStructureTemplateRecords.mockReset();
    mocks.updateExamStructureTemplateRecord.mockReset();
  });

  it("allows an ADMIN to create, edit, and delete a custom template", async () => {
    const input = createValidInput();
    const createdTemplate = createStoredTemplate();
    const editedAt = new Date("2026-01-03T00:00:00.000Z");
    const editedTemplate = createStoredTemplate({
      name: "Kiểm tra chương đã sửa",
      updatedAt: editedAt,
    });
    const updateInput: UpdateExamStructureTemplateInput = {
      ...input,
      name: editedTemplate.name,
      expectedUpdatedAt: updatedAt.toISOString(),
    };
    mocks.createExamStructureTemplateRecord.mockResolvedValue(createdTemplate);
    mocks.findExamStructureTemplateRecordById
      .mockResolvedValueOnce(createdTemplate)
      .mockResolvedValueOnce(editedTemplate);
    mocks.updateExamStructureTemplateRecord.mockResolvedValue(editedTemplate);
    mocks.deleteExamStructureTemplateRecord.mockResolvedValue(editedTemplate);

    await expect(
      createExamStructureTemplate(admin, input),
    ).resolves.toMatchObject({ name: input.name, isBuiltIn: false });
    await expect(
      editExamStructureTemplate(admin, createdTemplate.id, updateInput),
    ).resolves.toMatchObject({
      name: editedTemplate.name,
      updatedAt: editedAt.toISOString(),
    });
    await expect(
      deleteExamStructureTemplate(admin, editedTemplate.id, {
        expectedUpdatedAt: editedAt.toISOString(),
      }),
    ).resolves.toBeUndefined();

    expect(mocks.createExamStructureTemplateRecord).toHaveBeenCalledWith(input);
    expect(mocks.updateExamStructureTemplateRecord).toHaveBeenCalledWith(
      createdTemplate.id,
      { name: editedTemplate.name, sections: input.sections },
      updatedAt,
    );
    expect(mocks.deleteExamStructureTemplateRecord).toHaveBeenCalledWith(
      editedTemplate.id,
      editedAt,
    );
  });

  it("does not allow the built-in template to be edited or deleted", async () => {
    const builtInTemplate = createStoredTemplate({
      name: "Chuẩn thi THPT",
      isBuiltIn: true,
    });
    mocks.findExamStructureTemplateRecordById.mockResolvedValue(
      builtInTemplate,
    );

    await expect(
      editExamStructureTemplate(admin, builtInTemplate.id, {
        ...createValidInput(),
        expectedUpdatedAt: updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({
      code: "BUILT_IN_EXAM_STRUCTURE_TEMPLATE_READ_ONLY",
      statusCode: 409,
    });
    await expect(
      deleteExamStructureTemplate(admin, builtInTemplate.id, {
        expectedUpdatedAt: updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({
      code: "BUILT_IN_EXAM_STRUCTURE_TEMPLATE_READ_ONLY",
      statusCode: 409,
    });
    expect(mocks.updateExamStructureTemplateRecord).not.toHaveBeenCalled();
    expect(mocks.deleteExamStructureTemplateRecord).not.toHaveBeenCalled();
  });

  it("denies every template-management operation to a non-ADMIN", async () => {
    const input = createValidInput();

    await expect(listExamStructureTemplates(student)).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    await expect(
      createExamStructureTemplate(student, input),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    await expect(
      editExamStructureTemplate(student, "507f1f77bcf86cd799439011", {
        ...input,
        expectedUpdatedAt: updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    await expect(
      deleteExamStructureTemplate(student, "507f1f77bcf86cd799439011", {
        expectedUpdatedAt: updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });

    expect(mocks.listExamStructureTemplateRecords).not.toHaveBeenCalled();
    expect(mocks.createExamStructureTemplateRecord).not.toHaveBeenCalled();
    expect(mocks.findExamStructureTemplateRecordById).not.toHaveBeenCalled();
  });
});
