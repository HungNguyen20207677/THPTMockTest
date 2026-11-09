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
import { cn } from "@/lib/utils";
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

const statusClassNames: Record<ExamStatus, string> = {
  DRAFT: "border-input bg-muted/60 text-muted-foreground",
  PUBLISHED:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  HIDDEN:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
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
        <div className="min-w-56 max-w-sm">
          <span className="font-semibold">{getValue()}</span>
          <p className="text-muted-foreground mt-1 text-xs">
            Tạo ngày {dateFormatter.format(new Date(row.original.createdAt))}
          </p>
          {row.original.hasAttempts && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              <span className="size-1.5 rounded-full bg-current" />
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
          className={cn(
            "focus-visible:border-ring focus-visible:ring-ring/40 h-8 cursor-pointer rounded-full border px-2.5 text-xs font-semibold outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
            statusClassNames[getValue()],
          )}
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
    columnHelper.display({
      id: "settings",
      header: "Thiết lập",
      cell: ({ row }) => (
        <div className="min-w-32 space-y-1.5 text-xs">
          <p className="font-medium">
            {row.original.visibilityMode === EXAM_VISIBILITY_MODE.ALL_STUDENTS
              ? "Tất cả học sinh"
              : `${row.original.assignedStudentCount} học sinh`}
          </p>
          <p className="text-muted-foreground">
            {row.original.settings.allowRetake
              ? "Cho phép làm lại"
              : "Không cho làm lại"}
          </p>
        </div>
      ),
    }),
    columnHelper.display({
      id: "visibility",
      header: "Sau khi nộp",
      cell: ({ row }) => (
        <div className="min-w-28 space-y-1 text-xs">
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
    columnHelper.display({
      id: "actions",
      header: "Thao tác",
      cell: ({ row }) => (
        <div className="flex min-w-48 flex-wrap items-center justify-end gap-1">
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/exams/${row.original.id}/results`}>
              Kết quả
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/exams/${row.original.id}/edit`}>Chỉnh sửa</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={isBusy}
            aria-label={`Xóa đề thi ${row.original.title}`}
            onClick={(event) => onDelete(row.original, event.currentTarget)}
          >
            Xóa
          </Button>
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
    <div className="border-border bg-card overflow-x-auto rounded-lg border shadow-xs">
      <table className="w-full min-w-[54rem] border-collapse text-sm [&_td]:align-middle [&_th]:align-middle">
        <thead className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className={cn(
                    "text-muted-foreground px-4 py-2.5 text-left text-xs font-semibold tracking-wide uppercase",
                    header.column.id === "actions" && "text-right",
                  )}
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
            <tr
              key={row.id}
              className="border-border hover:bg-muted/30 border-t transition-colors"
            >
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3.5 align-middle">
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
