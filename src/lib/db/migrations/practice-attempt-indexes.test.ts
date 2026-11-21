import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aggregateNext: vi.fn(),
  attemptCountDocuments: vi.fn(),
  createIndex: vi.fn(),
  dropIndex: vi.fn(),
  examCountDocuments: vi.fn(),
  listIndexes: vi.fn(),
}));

vi.mock("@/lib/db/mongoose", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({
    connection: {
      collection: (name: string) =>
        name === "examattempts"
          ? {
              aggregate: () => ({ next: mocks.aggregateNext }),
              countDocuments: mocks.attemptCountDocuments,
              createIndex: mocks.createIndex,
              dropIndex: mocks.dropIndex,
              listIndexes: () => ({ toArray: mocks.listIndexes }),
            }
          : { countDocuments: mocks.examCountDocuments },
    },
  }),
}));

import {
  assertPracticeAttemptMigrationReady,
  inspectPracticeAttemptMigration,
  rollbackPracticeAttemptMigration,
  type PracticeAttemptMigrationInspection,
} from "@/lib/db/migrations/practice-attempt-indexes";

function createInspection(
  overrides: Partial<PracticeAttemptMigrationInspection> = {},
): PracticeAttemptMigrationInspection {
  return {
    missingAttemptModes: 0,
    invalidAttemptModes: 0,
    missingPracticeEnabled: 0,
    invalidMockExpirations: 0,
    invalidPracticeExpirations: 0,
    duplicateModeNumberKeys: 0,
    legacyNumberIndexPresent: false,
    modeNumberIndexReady: true,
    activeIndexPresent: true,
    ...overrides,
  };
}

describe("Practice attempt migration readiness", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.aggregateNext.mockResolvedValue(null);
    mocks.attemptCountDocuments.mockResolvedValue(0);
    mocks.examCountDocuments.mockResolvedValue(0);
    mocks.createIndex.mockResolvedValue("index-name");
    mocks.dropIndex.mockResolvedValue(undefined);
  });

  it("accepts only a fully backfilled mode-scoped index state", () => {
    expect(() =>
      assertPracticeAttemptMigrationReady(createInspection()),
    ).not.toThrow();
  });

  it("blocks Practice while the legacy numbering index remains", () => {
    expect(() =>
      assertPracticeAttemptMigrationReady(
        createInspection({ legacyNumberIndexPresent: true }),
      ),
    ).toThrow(/migration completes/);
  });

  it.each([
    ["missing modes", { missingAttemptModes: 1 }],
    ["duplicate numbering keys", { duplicateModeNumberKeys: 1 }],
    ["invalid Mock expiration", { invalidMockExpirations: 1 }],
    ["invalid Practice expiration", { invalidPracticeExpirations: 1 }],
    ["missing active index", { activeIndexPresent: false }],
  ])("blocks Practice for %s", (_label, overrides) => {
    expect(() =>
      assertPracticeAttemptMigrationReady(createInspection(overrides)),
    ).toThrow();
  });

  it("rejects partially scoped numbering and active indexes", async () => {
    mocks.listIndexes.mockResolvedValue([
      {
        name: "unique_attempt_number_per_student_exam_mode",
        key: { studentId: 1, examId: 1, mode: 1, attemptNumber: 1 },
        unique: true,
        partialFilterExpression: { mode: "PRACTICE" },
      },
      {
        name: "unique_active_attempt_per_student_exam",
        key: { studentId: 1, examId: 1 },
        unique: true,
        partialFilterExpression: { status: "IN_PROGRESS", mode: "MOCK" },
      },
    ]);

    await expect(inspectPracticeAttemptMigration()).resolves.toMatchObject({
      modeNumberIndexReady: false,
      activeIndexPresent: false,
    });
  });

  it("refuses rollback when the legacy index name has a malformed definition", async () => {
    mocks.listIndexes.mockResolvedValue([
      {
        name: "unique_attempt_number_per_student_exam_mode",
        key: { studentId: 1, examId: 1, mode: 1, attemptNumber: 1 },
        unique: true,
      },
      {
        name: "unique_attempt_number_per_student_exam",
        key: { studentId: 1, examId: 1 },
        unique: true,
      },
    ]);

    await expect(rollbackPracticeAttemptMigration()).rejects.toThrow(
      /unexpected definition/,
    );
    expect(mocks.dropIndex).not.toHaveBeenCalled();
  });
});
