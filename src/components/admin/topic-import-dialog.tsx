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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/lib/api/client";
import { importTopicRecords, previewTopicImport } from "@/lib/api/topics";
import type { TopicImportInput } from "@/lib/validations/topic";
import type { TopicImportPreview } from "@/types/topic";

const EXAMPLE_JSON = `{
  "groups": [
    {
      "grade": "Khối 12",
      "chapter": "Hàm số",
      "topics": ["Cực trị", "Tiệm cận"]
    }
  ]
}`;

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "Không thể xử lý tệp nhập. Vui lòng thử lại.";
}

export function TopicImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (createdCount: number, skippedCount: number) => void;
}) {
  const [json, setJson] = useState(EXAMPLE_JSON);
  const [preview, setPreview] = useState<TopicImportPreview | null>(null);
  const [previewInput, setPreviewInput] = useState<TopicImportInput | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handlePreview() {
    setError(null);
    setPreview(null);
    setPreviewInput(null);
    let input: TopicImportInput;
    try {
      input = JSON.parse(json) as TopicImportInput;
    } catch {
      setError("Nội dung JSON không hợp lệ.");
      return;
    }

    setIsPending(true);
    try {
      const response = await previewTopicImport(input);
      setPreview(response.data.preview);
      setPreviewInput(input);
    } catch (previewError) {
      setError(getErrorMessage(previewError));
    } finally {
      setIsPending(false);
    }
  }

  async function handleImport() {
    if (!previewInput || !preview?.canImport) return;
    setError(null);
    setIsPending(true);
    try {
      const response = await importTopicRecords(previewInput);
      onImported(
        response.data.result.createdCount,
        response.data.result.skippedCount,
      );
    } catch (importError) {
      setError(getErrorMessage(importError));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nhập chủ đề từ JSON</DialogTitle>
          <DialogDescription>
            Chỉ dùng khối và chương đã tồn tại. Xem trước không ghi dữ liệu;
            bước nhập sau đó là một giao dịch toàn vẹn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="topic-import-json">Nội dung JSON</Label>
          <Textarea
            id="topic-import-json"
            className="min-h-52 font-mono text-xs"
            value={json}
            disabled={isPending}
            spellCheck={false}
            onChange={(event) => {
              setJson(event.target.value);
              setPreview(null);
              setPreviewInput(null);
            }}
          />
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        {preview && (
          <div className="space-y-3" aria-live="polite">
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <span className="bg-muted rounded-md px-3 py-2">
                Tổng: {preview.summary.totalCount}
              </span>
              <span className="rounded-md bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-300">
                Tạo mới: {preview.summary.createCount}
              </span>
              <span className="rounded-md bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
                Bỏ qua: {preview.summary.skippedCount}
              </span>
              <span className="bg-destructive/10 text-destructive rounded-md px-3 py-2">
                Lỗi: {preview.summary.errorCount}
              </span>
            </div>
            <div className="border-border max-h-48 overflow-y-auto rounded-md border">
              <ul className="divide-border divide-y text-sm">
                {preview.items.map((item, index) => (
                  <li
                    key={`${item.grade}-${item.chapter}-${item.topic}-${index}`}
                    className="px-3 py-2"
                  >
                    <span className="font-medium">{item.topic}</span>
                    <span className="text-muted-foreground ml-2">
                      {item.grade} / {item.chapter}
                    </span>
                    <span className="ml-2 text-xs font-semibold">
                      {item.status === "CREATE"
                        ? "Tạo mới"
                        : item.status === "SKIP_EXISTING"
                          ? "Đã tồn tại"
                          : `Lỗi: ${item.message}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onClose}
          >
            Đóng
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => void handlePreview()}
          >
            {isPending && !preview ? "Đang kiểm tra..." : "Xem trước"}
          </Button>
          <Button
            type="button"
            disabled={
              isPending ||
              !preview?.canImport ||
              preview.summary.createCount === 0
            }
            onClick={() => void handleImport()}
          >
            {isPending && preview ? "Đang nhập..." : "Nhập chủ đề"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
