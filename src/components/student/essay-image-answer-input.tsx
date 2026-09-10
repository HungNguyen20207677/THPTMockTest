"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ESSAY_IMAGE_MAX_COUNT } from "@/lib/constants/exam-attempt";
import type { EssayImageAnswer } from "@/types/exam-attempt";

interface FailedUpload {
  id: number;
  file: File;
  message: string;
}

interface EssayImageAnswerInputProps {
  answer: EssayImageAnswer;
  disabled: boolean;
  onFilePickerOpen: () => void;
  onFilePickerReturn: () => void;
  onUpload: (file: File) => Promise<void>;
  onRemove: (publicId: string) => Promise<void>;
}

function getMutationError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function EssayImageAnswerInput({
  answer,
  disabled,
  onFilePickerOpen,
  onFilePickerReturn,
  onUpload,
  onRemove,
}: EssayImageAnswerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const failedUploadIdRef = useRef(0);
  const [uploadingFilename, setUploadingFilename] = useState<string | null>(
    null,
  );
  const [failedUploads, setFailedUploads] = useState<FailedUpload[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removingPublicIds, setRemovingPublicIds] = useState<string[]>([]);
  const [removeErrors, setRemoveErrors] = useState<Record<string, string>>({});
  const availableSlots = ESSAY_IMAGE_MAX_COUNT - answer.images.length;

  async function uploadFiles(files: File[]) {
    setUploadError(null);
    const selectedFiles = files.slice(0, Math.max(0, availableSlots));

    if (files.length > selectedFiles.length) {
      setUploadError(
        `Chỉ có thể tải thêm ${Math.max(0, availableSlots)} ảnh cho câu này.`,
      );
    }

    for (const file of selectedFiles) {
      setUploadingFilename(file.name);

      try {
        await onUpload(file);
      } catch (error) {
        failedUploadIdRef.current += 1;
        setFailedUploads((current) => [
          ...current,
          {
            id: failedUploadIdRef.current,
            file,
            message: getMutationError(
              error,
              "Không thể tải ảnh. Vui lòng thử lại.",
            ),
          },
        ]);
      }
    }

    setUploadingFilename(null);
  }

  async function retryUpload(failedUpload: FailedUpload) {
    setUploadingFilename(failedUpload.file.name);

    try {
      await onUpload(failedUpload.file);
      setFailedUploads((current) =>
        current.filter((item) => item.id !== failedUpload.id),
      );
    } catch (error) {
      setFailedUploads((current) =>
        current.map((item) =>
          item.id === failedUpload.id
            ? {
                ...item,
                message: getMutationError(
                  error,
                  "Không thể tải ảnh. Vui lòng thử lại.",
                ),
              }
            : item,
        ),
      );
    } finally {
      setUploadingFilename(null);
    }
  }

  async function removeImage(publicId: string) {
    setRemovingPublicIds((current) => [...current, publicId]);
    setRemoveErrors((current) => {
      const next = { ...current };
      delete next[publicId];
      return next;
    });

    try {
      await onRemove(publicId);
    } catch (error) {
      setRemoveErrors((current) => ({
        ...current,
        [publicId]: getMutationError(
          error,
          "Không thể xóa ảnh. Vui lòng thử lại.",
        ),
      }));
    } finally {
      setRemovingPublicIds((current) =>
        current.filter((candidate) => candidate !== publicId),
      );
    }
  }

  function openFilePicker() {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    onFilePickerOpen();
    window.addEventListener("focus", onFilePickerReturn, { once: true });
    input.click();
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={disabled || Boolean(uploadingFilename) || availableSlots <= 0}
        onChange={(event) => {
          onFilePickerReturn();
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";

          if (files.length > 0) {
            void uploadFiles(files);
          }
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            disabled || Boolean(uploadingFilename) || availableSlots <= 0
          }
          onClick={openFilePicker}
        >
          {uploadingFilename ? "Đang tải ảnh..." : "Tải ảnh bài làm"}
        </Button>
        <span className="text-muted-foreground text-xs">
          Tối đa {ESSAY_IMAGE_MAX_COUNT} ảnh · JPEG, PNG hoặc WebP · 10 MB/ảnh
        </span>
      </div>

      {uploadingFilename && (
        <p role="status" className="text-muted-foreground text-xs">
          Đang tải và xác minh {uploadingFilename}...
        </p>
      )}
      {uploadError && (
        <p role="alert" className="text-destructive text-xs">
          {uploadError}
        </p>
      )}

      {answer.images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {answer.images.map((image, index) => {
            const isRemoving = removingPublicIds.includes(image.publicId);
            return (
              <li
                key={image.publicId}
                className="border-border bg-background overflow-hidden rounded-lg border"
              >
                <div className="bg-muted relative aspect-[4/3]">
                  <Image
                    src={image.secureUrl}
                    alt={`Ảnh bài làm ${index + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 12rem"
                    className="object-contain"
                  />
                </div>
                <div className="space-y-2 p-2">
                  <p
                    className="truncate text-xs"
                    title={image.originalFilename}
                  >
                    {image.originalFilename}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive w-full"
                    disabled={disabled || isRemoving}
                    onClick={() => void removeImage(image.publicId)}
                  >
                    {isRemoving ? "Đang xóa..." : "Xóa ảnh"}
                  </Button>
                  {removeErrors[image.publicId] && (
                    <p role="alert" className="text-destructive text-xs">
                      {removeErrors[image.publicId]}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {failedUploads.length > 0 && (
        <div className="space-y-2">
          {failedUploads.map((failedUpload) => (
            <div
              key={failedUpload.id}
              className="border-destructive/30 bg-destructive/5 rounded-md border p-2 text-xs"
            >
              <p className="font-medium">{failedUpload.file.name}</p>
              <p role="alert" className="text-destructive mt-1">
                {failedUpload.message}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                disabled={disabled || Boolean(uploadingFilename)}
                onClick={() => void retryUpload(failedUpload)}
              >
                Thử lại
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
