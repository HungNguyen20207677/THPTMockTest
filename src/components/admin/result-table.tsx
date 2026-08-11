"use client";

import {
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import {
  formatDuration,
  scoreFormatter,
  vietnamDateTimeFormatter,
} from "@/lib/formatting";
import type { AdminResultSummary } from "@/types/reporting";

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, AdminResultSummary>();

export function AdminResultTable({
  results,
}: {
  results: AdminResultSummary[];
}) {
  const columns = columnHelper.columns([
    columnHelper.display({
      id: "student",
      header: "Học sinh",
      cell: ({ row }) =>
        row.original.student ? (
          <div>
            <Link
              className="font-medium underline-offset-4 hover:underline"
              href={`/admin/students/${row.original.student.id}`}
            >
              {row.original.student.fullName}
            </Link>
            <p className="text-muted-foreground text-xs">
              @{row.original.student.username}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">Tài khoản đã xóa</span>
        ),
    }),
    columnHelper.display({
      id: "exam",
      header: "Đề thi",
      cell: ({ row }) =>
        row.original.exam ? (
          <Link
            className="font-medium underline-offset-4 hover:underline"
            href={`/admin/exams/${row.original.exam.id}/results`}
          >
            {row.original.exam.title}
          </Link>
        ) : (
          <span className="text-muted-foreground">
            Đề thi không còn tồn tại
          </span>
        ),
    }),
    columnHelper.accessor("attemptNumber", {
      header: "Lần làm",
      cell: ({ getValue }) => getValue(),
    }),
    columnHelper.accessor("status", {
      header: "Cách nộp",
      cell: ({ getValue }) =>
        getValue() === EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED
          ? "Tự động"
          : "Chủ động",
    }),
    columnHelper.accessor("submittedAt", {
      header: "Nộp bài",
      cell: ({ getValue }) =>
        vietnamDateTimeFormatter.format(new Date(getValue())),
    }),
    columnHelper.accessor("timeUsedSeconds", {
      header: "Thời gian",
      cell: ({ getValue }) => formatDuration(getValue()),
    }),
    columnHelper.accessor("score.total", {
      header: "Điểm",
      cell: ({ getValue }) => (
        <span className="font-semibold tabular-nums">
          {scoreFormatter.format(getValue())}
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Thao tác</span>,
      cell: ({ row }) => (
        <Button asChild size="sm" variant="outline">
          <Link
            href={`/admin/results/${row.original.id}`}
            aria-label={`Xem chi tiết lần làm ${row.original.attemptNumber}`}
          >
            Chi tiết
          </Link>
        </Button>
      ),
    }),
  ]);
  const table = useTable({
    data: results,
    columns,
    features,
    getRowId: (result) => result.id,
  });

  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full min-w-5xl border-collapse text-sm">
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
                <td key={cell.id} className="px-4 py-3 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {results.length === 0 && (
            <tr className="border-border border-t">
              <td
                colSpan={columns.length}
                className="text-muted-foreground px-4 py-10 text-center"
              >
                Chưa có kết quả bài làm.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
