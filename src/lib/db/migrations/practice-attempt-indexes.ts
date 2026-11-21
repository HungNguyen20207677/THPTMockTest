import "server-only";

import type { IndexDescriptionInfo } from "mongodb";

import {
  EXAM_ATTEMPT_MODE,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { connectToDatabase } from "@/lib/db/mongoose";

export const LEGACY_ATTEMPT_NUMBER_INDEX =
  "unique_attempt_number_per_student_exam";
export const MODE_ATTEMPT_NUMBER_INDEX =
  "unique_attempt_number_per_student_exam_mode";
export const ACTIVE_ATTEMPT_INDEX = "unique_active_attempt_per_student_exam";

const MODE_ATTEMPT_NUMBER_KEY = {
  studentId: 1,
  examId: 1,
  mode: 1,
  attemptNumber: 1,
} as const;
const BATCH_SIZE = 500;

export interface PracticeAttemptMigrationInspection {
  missingAttemptModes: number;
  invalidAttemptModes: number;
  missingPracticeEnabled: number;
  invalidMockExpirations: number;
  invalidPracticeExpirations: number;
  duplicateModeNumberKeys: number;
  legacyNumberIndexPresent: boolean;
  modeNumberIndexReady: boolean;
  activeIndexPresent: boolean;
}

function hasIndexKey(
  index: IndexDescriptionInfo | undefined,
  expected: Record<string, number>,
): boolean {
  if (!index) return false;
  const actualEntries = Object.entries(index.key);
  const expectedEntries = Object.entries(expected);
  return (
    actualEntries.length === expectedEntries.length &&
    actualEntries.every(
      ([field, direction], position) =>
        expectedEntries[position]?.[0] === field &&
        expectedEntries[position]?.[1] === direction,
    )
  );
}

function hasUnscopedUniqueDefinition(
  index: IndexDescriptionInfo | undefined,
  expectedKey: Record<string, number>,
): boolean {
  return Boolean(
    index?.unique === true &&
    index.sparse !== true &&
    index.partialFilterExpression === undefined &&
    hasIndexKey(index, expectedKey),
  );
}

function hasExactActiveDefinition(
  index: IndexDescriptionInfo | undefined,
): boolean {
  if (
    index?.unique !== true ||
    index.sparse === true ||
    !hasIndexKey(index, { studentId: 1, examId: 1 })
  ) {
    return false;
  }
  const partialFilter = index.partialFilterExpression;
  return Boolean(
    partialFilter &&
    Object.keys(partialFilter).length === 1 &&
    partialFilter.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS,
  );
}

async function getCollections() {
  const database = await connectToDatabase();
  return {
    attempts: database.connection.collection("examattempts"),
    exams: database.connection.collection("exams"),
  };
}

async function listAttemptIndexes(): Promise<IndexDescriptionInfo[]> {
  const { attempts } = await getCollections();
  try {
    return await attempts.listIndexes().toArray();
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as Error & { code?: number }).code === 26
    ) {
      return [];
    }
    throw error;
  }
}

async function countDuplicateKeys(includeMode: boolean): Promise<number> {
  const { attempts } = await getCollections();
  const id = includeMode
    ? {
        studentId: "$studentId",
        examId: "$examId",
        mode: { $ifNull: ["$mode", EXAM_ATTEMPT_MODE.MOCK] },
        attemptNumber: "$attemptNumber",
      }
    : {
        studentId: "$studentId",
        examId: "$examId",
        attemptNumber: "$attemptNumber",
      };
  const result = await attempts
    .aggregate<{ count: number }>([
      { $group: { _id: id, records: { $sum: 1 } } },
      { $match: { records: { $gt: 1 } } },
      { $count: "count" },
    ])
    .next();
  return result?.count ?? 0;
}

export async function inspectPracticeAttemptMigration(): Promise<PracticeAttemptMigrationInspection> {
  const { attempts, exams } = await getCollections();
  const indexes = await listAttemptIndexes();
  const modeIndex = indexes.find(
    (index) => index.name === MODE_ATTEMPT_NUMBER_INDEX,
  );
  const activeIndex = indexes.find(
    (index) => index.name === ACTIVE_ATTEMPT_INDEX,
  );
  const [
    missingAttemptModes,
    invalidAttemptModes,
    missingPracticeEnabled,
    invalidMockExpirations,
    invalidPracticeExpirations,
    duplicateModeNumberKeys,
  ] = await Promise.all([
    attempts.countDocuments({ mode: { $exists: false } }),
    attempts.countDocuments({
      mode: { $nin: [EXAM_ATTEMPT_MODE.MOCK, EXAM_ATTEMPT_MODE.PRACTICE] },
    }),
    exams.countDocuments({ practiceEnabled: { $exists: false } }),
    attempts.countDocuments({
      mode: EXAM_ATTEMPT_MODE.MOCK,
      $or: [{ expiresAt: null }, { expiresAt: { $not: { $type: "date" } } }],
    }),
    attempts.countDocuments({
      mode: EXAM_ATTEMPT_MODE.PRACTICE,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $ne: null } }],
    }),
    countDuplicateKeys(true),
  ]);

  return {
    missingAttemptModes,
    invalidAttemptModes,
    missingPracticeEnabled,
    invalidMockExpirations,
    invalidPracticeExpirations,
    duplicateModeNumberKeys,
    legacyNumberIndexPresent: indexes.some(
      (index) => index.name === LEGACY_ATTEMPT_NUMBER_INDEX,
    ),
    modeNumberIndexReady: hasUnscopedUniqueDefinition(
      modeIndex,
      MODE_ATTEMPT_NUMBER_KEY,
    ),
    activeIndexPresent: hasExactActiveDefinition(activeIndex),
  };
}

async function backfillInBatches(
  collectionName: "examattempts" | "exams",
  filter: Record<string, unknown>,
  update: Record<string, unknown>,
): Promise<number> {
  const database = await connectToDatabase();
  const collection = database.connection.collection(collectionName);
  let updated = 0;

  while (true) {
    const documents = await collection
      .find(filter, { projection: { _id: 1 } })
      .limit(BATCH_SIZE)
      .toArray();
    if (documents.length === 0) break;
    const result = await collection.updateMany(
      { _id: { $in: documents.map((document) => document._id) }, ...filter },
      update,
    );
    updated += result.modifiedCount;
  }

  return updated;
}

function assertBackfillAndDataReady(
  inspection: PracticeAttemptMigrationInspection,
): void {
  if (
    inspection.missingAttemptModes > 0 ||
    inspection.invalidAttemptModes > 0 ||
    inspection.missingPracticeEnabled > 0 ||
    inspection.invalidMockExpirations > 0 ||
    inspection.invalidPracticeExpirations > 0 ||
    inspection.duplicateModeNumberKeys > 0
  ) {
    throw new Error(
      "Practice attempt migration verification failed; inspect the reported counts before changing indexes.",
    );
  }
  if (!inspection.activeIndexPresent) {
    throw new Error("The cross-mode active-attempt index is missing.");
  }
}

export async function applyPracticeAttemptMigration(): Promise<PracticeAttemptMigrationInspection> {
  const { attempts } = await getCollections();
  await backfillInBatches(
    "examattempts",
    { mode: { $exists: false } },
    { $set: { mode: EXAM_ATTEMPT_MODE.MOCK } },
  );
  await backfillInBatches(
    "exams",
    { practiceEnabled: { $exists: false } },
    { $set: { practiceEnabled: false } },
  );

  const beforeIndexes = await inspectPracticeAttemptMigration();
  assertBackfillAndDataReady(beforeIndexes);
  if (!beforeIndexes.modeNumberIndexReady) {
    await attempts.createIndex(MODE_ATTEMPT_NUMBER_KEY, {
      name: MODE_ATTEMPT_NUMBER_INDEX,
      unique: true,
    });
  }

  const afterCreate = await inspectPracticeAttemptMigration();
  if (!afterCreate.modeNumberIndexReady) {
    throw new Error("The mode-scoped attempt-number index was not verified.");
  }
  if (afterCreate.legacyNumberIndexPresent) {
    await attempts.dropIndex(LEGACY_ATTEMPT_NUMBER_INDEX);
  }

  const result = await inspectPracticeAttemptMigration();
  assertPracticeAttemptMigrationReady(result);
  return result;
}

export function assertPracticeAttemptMigrationReady(
  inspection: PracticeAttemptMigrationInspection,
): void {
  assertBackfillAndDataReady(inspection);
  if (!inspection.modeNumberIndexReady || inspection.legacyNumberIndexPresent) {
    throw new Error(
      "Practice attempt creation is disabled until the mode-scoped numbering-index migration completes.",
    );
  }
}

export async function verifyPracticeAttemptMigration(): Promise<PracticeAttemptMigrationInspection> {
  const inspection = await inspectPracticeAttemptMigration();
  assertPracticeAttemptMigrationReady(inspection);
  return inspection;
}

export async function rollbackPracticeAttemptMigration(): Promise<PracticeAttemptMigrationInspection> {
  const { attempts } = await getCollections();
  const crossModeDuplicates = await countDuplicateKeys(false);
  if (crossModeDuplicates > 0) {
    throw new Error(
      "Rollback is unsafe: cross-mode attempt-number collisions exist. Disable Practice and remove or renumber Practice data first.",
    );
  }

  const indexes = await listAttemptIndexes();
  const legacyIndex = indexes.find(
    (index) => index.name === LEGACY_ATTEMPT_NUMBER_INDEX,
  );
  if (
    legacyIndex &&
    !hasUnscopedUniqueDefinition(legacyIndex, {
      studentId: 1,
      examId: 1,
      attemptNumber: 1,
    })
  ) {
    throw new Error(
      "Rollback is unsafe: the legacy attempt-number index name has an unexpected definition.",
    );
  }
  if (!legacyIndex) {
    await attempts.createIndex(
      { studentId: 1, examId: 1, attemptNumber: 1 },
      { name: LEGACY_ATTEMPT_NUMBER_INDEX, unique: true },
    );
  }
  if (indexes.some((index) => index.name === MODE_ATTEMPT_NUMBER_INDEX)) {
    await attempts.dropIndex(MODE_ATTEMPT_NUMBER_INDEX);
  }
  return inspectPracticeAttemptMigration();
}
