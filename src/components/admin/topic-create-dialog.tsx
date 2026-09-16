"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreateTopicInput } from "@/lib/validations/topic";
import type { Chapter, Grade } from "@/types/curriculum";

interface TopicCreateDialogProps {
  open: boolean;
  initialName: string;
  grades: Grade[];
  chapters: Chapter[];
  isCreating: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: CreateTopicInput) => Promise<void>;
}

function subscribeToClientRender(): () => void {
  return () => undefined;
}

export function TopicCreateDialog({
  open,
  initialName,
  grades,
  chapters,
  isCreating,
  error,
  onClose,
  onCreate,
}: TopicCreateDialogProps) {
  const generatedId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isClientRender = useSyncExternalStore(
    subscribeToClientRender,
    () => true,
    () => false,
  );
  const [name, setName] = useState(initialName);
  const [gradeId, setGradeId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const availableChapters = chapters.filter(
    (chapter) => chapter.gradeId === gradeId,
  );
  const titleId = `${generatedId}-title`;
  const gradeInputId = `${generatedId}-grade`;
  const chapterInputId = `${generatedId}-chapter`;
  const nameInputId = `${generatedId}-name`;

  const portalContainer = isClientRender ? document.body : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      setName(initialName);
      setGradeId("");
      setChapterId("");
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [initialName, open, portalContainer]);

  if (!portalContainer) {
    return null;
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="backdrop:bg-foreground/40 m-auto w-[min(92vw,30rem)] rounded-xl border p-0 shadow-xl backdrop:backdrop-blur-sm"
      onCancel={(event) => {
        if (isCreating) {
          event.preventDefault();
        } else {
          onClose();
        }
      }}
      onClose={onClose}
    >
      <form
        className="bg-background space-y-5 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (chapterId) {
            void onCreate({ chapterId, name });
          }
        }}
      >
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            Tạo chủ đề kiến thức
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Chọn đúng khối và chương trước khi thêm chủ đề vào câu hỏi.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={gradeInputId}>Khối</Label>
          <select
            id={gradeInputId}
            className="border-input bg-background h-9 w-full cursor-pointer rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            value={gradeId}
            required
            disabled={isCreating}
            onChange={(event) => {
              setGradeId(event.target.value);
              setChapterId("");
            }}
          >
            <option value="">Chọn khối</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={chapterInputId}>Chương</Label>
          <select
            id={chapterInputId}
            className="border-input bg-background h-9 w-full cursor-pointer rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            value={chapterId}
            required
            disabled={isCreating || !gradeId}
            onChange={(event) => setChapterId(event.target.value)}
          >
            <option value="">Chọn chương</option>
            {availableChapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={nameInputId}>Tên chủ đề</Label>
          <Input
            id={nameInputId}
            value={name}
            required
            disabled={isCreating}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {(grades.length === 0 ||
          (gradeId && availableChapters.length === 0)) && (
          <p className="text-muted-foreground text-sm">
            Chưa có khối hoặc chương phù hợp. Quản lý tại{" "}
            <Link className="text-primary underline" href="/admin/topics">
              Chủ đề & kiến thức
            </Link>
            .
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isCreating}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={isCreating || !chapterId}>
            {isCreating ? "Đang tạo..." : "Tạo và chọn"}
          </Button>
        </div>
      </form>
    </dialog>,
    portalContainer,
  );
}
