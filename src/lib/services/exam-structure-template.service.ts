import "server-only";

import { USER_ROLE } from "@/lib/constants/roles";
import {
  createExamStructureTemplateRecord,
  deleteExamStructureTemplateRecord,
  findExamStructureTemplateRecordById,
  listExamStructureTemplateRecords,
  updateExamStructureTemplateRecord,
  type ExamStructureTemplatePersistenceRecord,
} from "@/lib/db/dao/exam-structure-template.dao";
import {
  BuiltInExamStructureTemplateReadOnlyError,
  ExamStructureTemplateConflictError,
  ExamStructureTemplateNotFoundError,
  ForbiddenError,
} from "@/lib/errors/app-error";
import { cloneExamStructureSnapshot } from "@/lib/exam/structure";
import {
  deleteExamStructureTemplateSchema,
  updateExamStructureTemplateSchema,
  upsertExamStructureTemplateSchema,
  type DeleteExamStructureTemplateInput,
  type UpdateExamStructureTemplateInput,
  type UpsertExamStructureTemplateInput,
} from "@/lib/validations/exam-structure-template";
import type { ExamStructureTemplate } from "@/types/exam-structure-template";
import type { AppUser } from "@/types/user";

function assertAdmin(actor: AppUser): void {
  if (actor.role !== USER_ROLE.ADMIN) {
    throw new ForbiddenError();
  }
}

function toExamStructureTemplate(
  template: ExamStructureTemplatePersistenceRecord,
): ExamStructureTemplate {
  return {
    id: template.id,
    name: template.name,
    isBuiltIn: template.isBuiltIn,
    ...cloneExamStructureSnapshot(template),
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

async function requireMutableTemplate(
  templateId: string,
): Promise<ExamStructureTemplatePersistenceRecord> {
  const template = await findExamStructureTemplateRecordById(templateId);

  if (!template) {
    throw new ExamStructureTemplateNotFoundError();
  }

  if (template.isBuiltIn) {
    throw new BuiltInExamStructureTemplateReadOnlyError();
  }

  return template;
}

export async function listExamStructureTemplates(
  actor: AppUser,
): Promise<ExamStructureTemplate[]> {
  assertAdmin(actor);
  const templates = await listExamStructureTemplateRecords();
  return templates.map(toExamStructureTemplate);
}

export async function createExamStructureTemplate(
  actor: AppUser,
  input: UpsertExamStructureTemplateInput,
): Promise<ExamStructureTemplate> {
  assertAdmin(actor);
  const validatedInput = upsertExamStructureTemplateSchema.parse(input);
  const template = await createExamStructureTemplateRecord(validatedInput);
  return toExamStructureTemplate(template);
}

export async function editExamStructureTemplate(
  actor: AppUser,
  templateId: string,
  input: UpdateExamStructureTemplateInput,
): Promise<ExamStructureTemplate> {
  assertAdmin(actor);
  const validatedInput = updateExamStructureTemplateSchema.parse(input);
  const currentTemplate = await requireMutableTemplate(templateId);

  if (
    currentTemplate.updatedAt.getTime() !==
    new Date(validatedInput.expectedUpdatedAt).getTime()
  ) {
    throw new ExamStructureTemplateConflictError();
  }

  const updatedTemplate = await updateExamStructureTemplateRecord(
    templateId,
    {
      name: validatedInput.name,
      sections: validatedInput.sections,
    },
    currentTemplate.updatedAt,
  );

  if (!updatedTemplate) {
    throw new ExamStructureTemplateConflictError();
  }

  return toExamStructureTemplate(updatedTemplate);
}

export async function deleteExamStructureTemplate(
  actor: AppUser,
  templateId: string,
  input: DeleteExamStructureTemplateInput,
): Promise<void> {
  assertAdmin(actor);
  const validatedInput = deleteExamStructureTemplateSchema.parse(input);
  const currentTemplate = await requireMutableTemplate(templateId);

  if (
    currentTemplate.updatedAt.getTime() !==
    new Date(validatedInput.expectedUpdatedAt).getTime()
  ) {
    throw new ExamStructureTemplateConflictError();
  }

  const deletedTemplate = await deleteExamStructureTemplateRecord(
    templateId,
    currentTemplate.updatedAt,
  );

  if (!deletedTemplate) {
    throw new ExamStructureTemplateConflictError();
  }
}
