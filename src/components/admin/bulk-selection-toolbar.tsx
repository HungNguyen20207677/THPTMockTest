"use client";

import { Button } from "@/components/ui/button";

export function BulkSelectionToolbar({
  selectedCount,
  entityLabel,
  isBusy,
  onClear,
  onDelete,
  deleteDisabled = false,
}: {
  selectedCount: number;
  entityLabel: string;
  isBusy: boolean;
  onClear: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
      aria-live="polite"
    >
      <p className="text-sm font-medium">
        Đã chọn {selectedCount} {entityLabel} trên trang hiện tại
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isBusy || deleteDisabled}
          onClick={onClear}
        >
          Bỏ chọn
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isBusy}
          onClick={onDelete}
        >
          Xóa mục đã chọn ({selectedCount})
        </Button>
      </div>
    </div>
  );
}
