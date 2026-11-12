"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bulkDeleteTopicRecords } from "@/lib/api/topics";
import type { Topic } from "@/types/topic";

interface TopicBulkDeleteDialogProps {
  topics: Topic[];
  scopeLabel: string;
  requireTypedConfirmation: boolean;
  onClose: () => void;
  onDeleted: (count: number) => void;
  onError: (error: unknown) => void;
}

export function TopicBulkDeleteDialog({
  topics,
  scopeLabel,
  requireTypedConfirmation,
  onClose,
  onDeleted,
  onError,
}: TopicBulkDeleteDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const canDelete =
    topics.length > 0 &&
    (!requireTypedConfirmation || confirmation.trim() === "XÓA");

  async function handleDelete() {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      const response = await bulkDeleteTopicRecords({
        topics: topics.map((topic) => ({
          id: topic.id,
          expectedUpdatedAt: topic.updatedAt,
        })),
      });
      onDeleted(response.data.deletedCount);
    } catch (error) {
      onError(error);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xóa {topics.length} chủ đề?</DialogTitle>
          <DialogDescription>
            Phạm vi: {scopeLabel}. Toàn bộ thao tác sẽ bị hủy nếu một chủ đề đã
            thay đổi hoặc đang được dùng trong đề thi.
          </DialogDescription>
        </DialogHeader>

        <div className="border-border bg-muted/30 max-h-40 overflow-y-auto rounded-md border p-3">
          <ul className="space-y-1 text-sm">
            {topics.map((topic) => (
              <li key={topic.id}>{topic.name}</li>
            ))}
          </ul>
        </div>

        {requireTypedConfirmation && (
          <div className="space-y-2">
            <Label htmlFor="bulk-delete-confirmation">
              Nhập <strong>XÓA</strong> để xác nhận xóa tất cả {topics.length}{" "}
              chủ đề trong phạm vi này
            </Label>
            <Input
              id="bulk-delete-confirmation"
              value={confirmation}
              autoComplete="off"
              disabled={isDeleting}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canDelete || isDeleting}
            onClick={() => void handleDelete()}
          >
            {isDeleting ? "Đang xóa..." : `Xóa ${topics.length} chủ đề`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
