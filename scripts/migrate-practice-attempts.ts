import { loadEnvConfig } from "@next/env";

import { disconnectFromDatabase } from "@/lib/db/mongoose";
import {
  applyPracticeAttemptMigration,
  inspectPracticeAttemptMigration,
  rollbackPracticeAttemptMigration,
  verifyPracticeAttemptMigration,
} from "@/lib/db/migrations/practice-attempt-indexes";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const command = process.argv[2] ?? "--dry-run";
  const result =
    command === "--apply"
      ? await applyPracticeAttemptMigration()
      : command === "--verify"
        ? await verifyPracticeAttemptMigration()
        : command === "--rollback"
          ? await rollbackPracticeAttemptMigration()
          : command === "--dry-run"
            ? await inspectPracticeAttemptMigration()
            : null;

  if (!result) {
    throw new Error("Use --dry-run, --apply, --verify, or --rollback.");
  }
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(disconnectFromDatabase);
