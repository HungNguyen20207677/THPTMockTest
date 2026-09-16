"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/api/client";
import {
  createChapterRecord,
  createGradeRecord,
  updateChapterRecord,
  updateGradeRecord,
} from "@/lib/api/curriculum";
import { createTopicRecord, updateTopicRecord } from "@/lib/api/topics";
import type { Chapter, Grade } from "@/types/curriculum";
import type { Topic } from "@/types/topic";

export type CurriculumEditorTarget =
  | { kind: "create-grade" }
  | { kind: "edit-grade"; grade: Grade }
  | { kind: "create-chapter"; gradeId: string }
  | { kind: "edit-chapter"; chapter: Chapter }
  | { kind: "create-topic"; chapterId: string }
  | { kind: "edit-topic"; topic: Topic };

interface CurriculumEditorProps {
  target: CurriculumEditorTarget;
  grades: Grade[];
  chapters: Chapter[];
  onCancel: () => void;
  onConflict: (message: string) => void;
  onSaved: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }
    return error.message;
  }
  return "Không thể lưu thay đổi. Vui lòng thử lại.";
}

function getInitialName(target: CurriculumEditorTarget): string {
  if (target.kind === "edit-grade") {
    return target.grade.name;
  }
  if (target.kind === "edit-chapter") {
    return target.chapter.name;
  }
  if (target.kind === "edit-topic") {
    return target.topic.name;
  }
  return "";
}

function getTitle(target: CurriculumEditorTarget): string {
  switch (target.kind) {
    case "create-grade":
      return "Thêm khối";
    case "edit-grade":
      return "Chỉnh sửa khối";
    case "create-chapter":
      return "Thêm chương";
    case "edit-chapter":
      return "Chỉnh sửa chương";
    case "create-topic":
      return "Thêm chủ đề";
    case "edit-topic":
      return target.topic.chapterId ? "Chỉnh sửa chủ đề" : "Phân loại chủ đề";
  }
}

export function CurriculumEditor({
  target,
  grades,
  chapters,
  onCancel,
  onConflict,
  onSaved,
}: CurriculumEditorProps) {
  const [name, setName] = useState(() => getInitialName(target));
  const [sortOrder, setSortOrder] = useState(() =>
    target.kind === "edit-grade" ? String(target.grade.sortOrder) : "0",
  );
  const [gradeId, setGradeId] = useState(() => {
    if (target.kind === "create-chapter") {
      return target.gradeId;
    }
    if (target.kind === "edit-chapter") {
      return target.chapter.gradeId;
    }
    return "";
  });
  const [chapterId, setChapterId] = useState(() => {
    if (target.kind === "create-topic") {
      return target.chapterId;
    }
    if (target.kind === "edit-topic") {
      return target.topic.chapterId ?? "";
    }
    return "";
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isGrade =
    target.kind === "create-grade" || target.kind === "edit-grade";
  const isChapter =
    target.kind === "create-chapter" || target.kind === "edit-chapter";

  async function handleSubmit() {
    setIsSaving(true);
    setError(null);

    try {
      switch (target.kind) {
        case "create-grade":
          await createGradeRecord({ name, sortOrder: Number(sortOrder) });
          break;
        case "edit-grade":
          await updateGradeRecord(target.grade.id, {
            name,
            sortOrder: Number(sortOrder),
            expectedUpdatedAt: target.grade.updatedAt,
          });
          break;
        case "create-chapter":
          await createChapterRecord({ name, gradeId });
          break;
        case "edit-chapter":
          await updateChapterRecord(target.chapter.id, {
            name,
            gradeId,
            expectedUpdatedAt: target.chapter.updatedAt,
          });
          break;
        case "create-topic":
          await createTopicRecord({ name, chapterId });
          break;
        case "edit-topic":
          await updateTopicRecord(target.topic.id, {
            name,
            chapterId,
            expectedUpdatedAt: target.topic.updatedAt,
          });
          break;
      }
      onSaved();
    } catch (saveError) {
      if (
        saveError instanceof ApiClientError &&
        saveError.code === "CURRICULUM_CONFLICT"
      ) {
        onConflict(saveError.message);
        return;
      }
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="border-primary/30 bg-primary/5 space-y-4 rounded-xl border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <div>
        <h2 className="font-semibold">{getTitle(target)}</h2>
        {target.kind === "edit-topic" && !target.topic.chapterId && (
          <p className="text-muted-foreground mt-1 text-sm">
            Chủ đề chưa phân loại phải được gắn với một chương trước khi lưu.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {isChapter && (
          <div className="space-y-2">
            <Label htmlFor="curriculum-grade">Khối</Label>
            <select
              id="curriculum-grade"
              className="border-input bg-background h-9 w-full cursor-pointer rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              value={gradeId}
              required
              disabled={isSaving}
              onChange={(event) => setGradeId(event.target.value)}
            >
              <option value="">Chọn khối</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isGrade && !isChapter && (
          <div className="space-y-2">
            <Label htmlFor="curriculum-chapter">Chương</Label>
            <select
              id="curriculum-chapter"
              className="border-input bg-background h-9 w-full cursor-pointer rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              value={chapterId}
              required
              disabled={isSaving}
              onChange={(event) => setChapterId(event.target.value)}
            >
              <option value="">Chọn chương</option>
              {grades.map((grade) => (
                <optgroup key={grade.id} label={grade.name}>
                  {chapters
                    .filter((chapter) => chapter.gradeId === grade.id)
                    .map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="curriculum-name">
            {isGrade ? "Tên khối" : isChapter ? "Tên chương" : "Tên chủ đề"}
          </Label>
          <Input
            id="curriculum-name"
            value={name}
            required
            disabled={isSaving}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {isGrade && (
          <div className="space-y-2">
            <Label htmlFor="curriculum-sort-order">Thứ tự hiển thị</Label>
            <Input
              id="curriculum-sort-order"
              type="number"
              step="1"
              value={sortOrder}
              required
              disabled={isSaving}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isSaving}
          onClick={onCancel}
        >
          Hủy
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>
    </form>
  );
}
