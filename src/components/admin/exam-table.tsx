"use client";

import {
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EXAM_STATUSES, EXAM_VISIBILITY_MODE } from "@/lib/constants/exam";
import type { ExamStatus, ExamSummary } from "@/types/exam";

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, ExamSummary>();
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeZone: "Asia/Ho_Chi_Minh",
});

const statusLabels: Record<ExamStatus, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
  HIDDEN: "Đã ẩn",
};

interface ExamTableProps {
  exams: ExamSummary[];
  isBusy: boolean;
  onStatusChange: (
    exam: ExamSummary,
    status: ExamStatus,
    trigger: HTMLSelectElement,
  ) => void;
  onDelete: (exam: ExamSummary, trigger: HTMLButtonElement) => void;
}

export function ExamTable({
  exams,
  isBusy,
  onStatusChange,
  onDelete,
}: ExamTableProps) {
  const columns = columnHelper.columns([
    columnHelper.accessor("title", {
      header: "Tên đề thi",
      cell: ({ row, getValue }) => (
        <div>
          <span className="font-medium">{getValue()}</span>
          {row.original.hasAttempts && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Nội dung đã khóa do có lượt làm
            </p>
          )}
        </div>
      ),
    }),
    columnHelper.accessor("status", {
      header: "Trạng thái",
      cell: ({ row, getValue }) => (
        <select
          className="border-input bg-background h-8 rounded-md border px-2 text-xs"
          value={getValue()}
          disabled={isBusy}
          aria-label={`Trạng thái của ${row.original.title}`}
          onChange={(event) =>
            onStatusChange(
              row.original,
              event.target.value as ExamStatus,
              event.currentTarget,
            )
          }
        >
          {EXAM_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      ),
    }),
    columnHelper.accessor("settings.allowRetake", {
      header: "Làm lại",
      cell: ({ getValue }) => (getValue() ? "Có" : "Không"),
    }),
    columnHelper.display({
      id: "assignment",
      header: "Phạm vi học sinh",
      cell: ({ row }) =>
        row.original.visibilityMode === EXAM_VISIBILITY_MODE.ALL_STUDENTS
          ? "Tất cả học sinh"
          : `${row.original.assignedStudentCount} học sinh`,
    }),
    columnHelper.display({
      id: "visibility",
      header: "Sau khi nộp",
      cell: ({ row }) => (
        <div className="space-y-1 text-xs">
          <p>
            Điểm:{" "}
            {row.original.settings.showScoreAfterSubmission ? "Có" : "Không"}
          </p>
          <p>
            Đáp án:{" "}
            {row.original.settings.showAnswersAfterSubmission ? "Có" : "Không"}
          </p>
        </div>
      ),
    }),
    columnHelper.accessor("createdAt", {
      header: "Ngày tạo",
      cell: ({ getValue }) => dateFormatter.format(new Date(getValue())),
    }),
    columnHelper.display({
      id: "actions",
      header: "Thao tác",
      cell: ({ row }) => (
        <div className="min-w-44 space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/exams/${row.original.id}/results`}>
                Kết quả
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/exams/${row.original.id}/edit`}>Sửa</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isBusy}
              aria-label={`Xóa đề thi ${row.original.title}`}
              onClick={(event) => onDelete(row.original, event.currentTarget)}
            >
              Xóa
            </Button>
          </div>
        </div>
      ),
    }),
  ]);
  const table = useTable({
    data: exams,
    columns,
    features,
    getRowId: (exam) => exam.id,
  });

  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full min-w-4xl border-collapse text-sm [&_td]:align-middle [&_th]:align-middle">
        <thead className="bg-muted/70">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className="px-4 py-3 text-left font-semibold"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-border border-t">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {exams.length === 0 && (
            <tr className="border-border border-t">
              <td
                colSpan={columns.length}
                className="text-muted-foreground px-4 py-10 text-center"
              >
                Chưa có đề thi.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
