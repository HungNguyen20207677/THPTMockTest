import type { BulkDeletionResult } from "@/types/bulk-deletion";

export function getDeletedBulkItemIds(result: BulkDeletionResult): Set<string> {
  return new Set(
    result.items
      .filter(
        (item) =>
          item.status === "DELETED" ||
          item.status === "MEDIA_CLEANUP_INCOMPLETE",
      )
      .map((item) => item.id),
  );
}

export function formatBulkDeletionResult(
  result: BulkDeletionResult,
  labels: Map<string, string>,
): string {
  const lines = [
    `Đã xóa ${result.deletedCount + result.mediaCleanupIncompleteCount}/${result.requestedCount} bản ghi.`,
  ];
  for (const item of result.items) {
    if (item.status !== "DELETED") {
      const status =
        item.status === "MEDIA_CLEANUP_INCOMPLETE"
          ? "Đã xóa dữ liệu, dọn dẹp tệp chưa hoàn tất"
          : item.status === "REJECTED"
            ? "Bị từ chối"
            : "Xóa thất bại";
      lines.push(
        `${labels.get(item.id) ?? item.id}: ${status}${item.message ? ` - ${item.message}` : ""}`,
      );
    }
  }
  return lines.join("\n");
}
