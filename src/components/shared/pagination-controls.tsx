"use client";

import { Button } from "@/components/ui/button";
import type { PaginationMetadata } from "@/types/reporting";

interface PaginationControlsProps {
  pagination: PaginationMetadata;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  pagination,
  disabled = false,
  onPageChange,
}: PaginationControlsProps) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Phân trang"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-muted-foreground text-sm">
        Trang {pagination.page} / {pagination.totalPages} ·{" "}
        {pagination.totalItems} kết quả
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          Trước
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Sau
        </Button>
      </div>
    </nav>
  );
}
