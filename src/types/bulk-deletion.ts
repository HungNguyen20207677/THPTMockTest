export type BulkDeletionItemStatus =
  "DELETED" | "REJECTED" | "FAILED" | "MEDIA_CLEANUP_INCOMPLETE";

export interface BulkDeletionItemResult {
  id: string;
  status: BulkDeletionItemStatus;
  code?: string;
  message?: string;
}

export interface BulkDeletionResult {
  requestedCount: number;
  deletedCount: number;
  rejectedCount: number;
  failedCount: number;
  mediaCleanupIncompleteCount: number;
  items: BulkDeletionItemResult[];
}
