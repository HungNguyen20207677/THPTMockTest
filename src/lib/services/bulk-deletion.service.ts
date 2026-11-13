import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { deleteExamStructureTemplate } from "@/lib/services/exam-structure-template.service";
import { deleteExam } from "@/lib/services/exam.service";
import { deleteStudent } from "@/lib/services/student.service";
import {
  bulkDeleteExamsSchema,
  bulkDeleteExamStructureTemplatesSchema,
  bulkDeleteStudentsSchema,
  type BulkDeleteExamsInput,
  type BulkDeleteExamStructureTemplatesInput,
  type BulkDeleteStudentsInput,
} from "@/lib/validations/bulk-deletion";
import type {
  BulkDeletionItemResult,
  BulkDeletionResult,
} from "@/types/bulk-deletion";
import type { HardDeleteResult } from "@/types/deletion";
import type { AppUser } from "@/types/user";

function summarize(items: BulkDeletionItemResult[]): BulkDeletionResult {
  return {
    requestedCount: items.length,
    deletedCount: items.filter((item) => item.status === "DELETED").length,
    rejectedCount: items.filter((item) => item.status === "REJECTED").length,
    failedCount: items.filter((item) => item.status === "FAILED").length,
    mediaCleanupIncompleteCount: items.filter(
      (item) => item.status === "MEDIA_CLEANUP_INCOMPLETE",
    ).length,
    items,
  };
}

async function runBoundedDeletes<T>(
  items: T[],
  getId: (item: T) => string,
  operation: (item: T) => Promise<void | HardDeleteResult>,
): Promise<BulkDeletionResult> {
  const results: BulkDeletionItemResult[] = [];

  // Sequential execution bounds destructive work and avoids multiplying media cleanup concurrency.
  for (const item of items) {
    const id = getId(item);
    try {
      const result = await operation(item);
      results.push(
        result?.cleanupWarning
          ? {
              id,
              status: "MEDIA_CLEANUP_INCOMPLETE",
              message: result.cleanupWarning,
            }
          : { id, status: "DELETED" },
      );
    } catch (error) {
      if (error instanceof AppError && error.statusCode < 500) {
        results.push({
          id,
          status: "REJECTED",
          code: error.code,
          message: error.message,
        });
      } else {
        console.error("Bulk deletion item failed", {
          id,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        results.push({
          id,
          status: "FAILED",
          message: "Không thể xóa bản ghi do lỗi hệ thống.",
        });
      }
    }
  }

  return summarize(results);
}

export async function bulkDeleteStudents(
  actor: AppUser,
  input: BulkDeleteStudentsInput,
): Promise<BulkDeletionResult> {
  const validated = bulkDeleteStudentsSchema.parse(input);
  return runBoundedDeletes(
    validated.items,
    (item) => item.id,
    (item) => deleteStudent(actor, item.id),
  );
}

export async function bulkDeleteExams(
  actor: AppUser,
  input: BulkDeleteExamsInput,
): Promise<BulkDeletionResult> {
  const validated = bulkDeleteExamsSchema.parse(input);
  return runBoundedDeletes(
    validated.items,
    (item) => item.id,
    (item) => deleteExam(actor, item.id, item.expectedUpdatedAt),
  );
}

export async function bulkDeleteExamStructureTemplates(
  actor: AppUser,
  input: BulkDeleteExamStructureTemplatesInput,
): Promise<BulkDeletionResult> {
  const validated = bulkDeleteExamStructureTemplatesSchema.parse(input);
  return runBoundedDeletes(
    validated.items,
    (item) => item.id,
    (item) =>
      deleteExamStructureTemplate(actor, item.id, {
        expectedUpdatedAt: item.expectedUpdatedAt,
      }),
  );
}
