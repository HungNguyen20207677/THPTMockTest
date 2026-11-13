"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function BulkDeleteConfirmationDialog({
  open,
  count,
  entityLabel,
  description,
  isPending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  count: number;
  entityLabel: string;
  description: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && !isPending && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Xóa {count} {entityLabel} đã chọn?
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-muted-foreground text-sm">
          Mỗi bản ghi được xử lý riêng. Bản ghi xóa thành công sẽ không được thử
          lại nếu bản ghi khác bị từ chối hoặc thất bại.
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Hủy</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending || count === 0}
            onClick={onConfirm}
          >
            {isPending ? "Đang xóa..." : `Xóa ${count} ${entityLabel}`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
