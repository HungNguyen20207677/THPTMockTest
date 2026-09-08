"use client";

import {
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  getExamStructureQuestionCount,
  getExamStructureTotalScoreHundredths,
} from "@/lib/exam/structure";
import { scoreFormatter } from "@/lib/formatting";
import type { ExamStructureTemplate } from "@/types/exam-structure-template";

const features = tableFeatures({});
const columnHelper = createColumnHelper<
  typeof features,
  ExamStructureTemplate
>();

interface ExamStructureTemplateTableProps {
  templates: ExamStructureTemplate[];
  isBusy: boolean;
  onEdit: (template: ExamStructureTemplate, trigger: HTMLButtonElement) => void;
  onDelete: (
    template: ExamStructureTemplate,
    trigger: HTMLButtonElement,
  ) => void;
}

export function ExamStructureTemplateTable({
  templates,
  isBusy,
  onEdit,
  onDelete,
}: ExamStructureTemplateTableProps) {
  const columns = columnHelper.columns([
    columnHelper.accessor("name", {
      header: "Tên mẫu",
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    }),
    columnHelper.accessor("isBuiltIn", {
      header: "Loại",
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
            Dựng sẵn
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
            Tùy chỉnh
          </span>
        ),
    }),
    columnHelper.display({
      id: "sections",
      header: "Số phần",
      cell: ({ row }) => row.original.sections.length,
    }),
    columnHelper.display({
      id: "questions",
      header: "Số câu",
      cell: ({ row }) => getExamStructureQuestionCount(row.original),
    }),
    columnHelper.display({
      id: "score",
      header: "Tổng điểm",
      cell: ({ row }) =>
        `${scoreFormatter.format(
          getExamStructureTotalScoreHundredths(row.original) / 100,
        )} điểm`,
    }),
    columnHelper.display({
      id: "actions",
      header: "Thao tác",
      cell: ({ row }) => {
        const template = row.original;

        if (template.isBuiltIn) {
          return <span className="text-muted-foreground text-xs">Chỉ đọc</span>;
        }

        return (
          <div className="flex min-w-32 flex-wrap items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBusy}
              aria-label={`Sửa mẫu cấu trúc ${template.name}`}
              onClick={(event) => onEdit(template, event.currentTarget)}
            >
              Sửa
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isBusy}
              aria-label={`Xóa mẫu cấu trúc ${template.name}`}
              onClick={(event) => onDelete(template, event.currentTarget)}
            >
              Xóa
            </Button>
          </div>
        );
      },
    }),
  ]);
  const table = useTable({
    data: templates,
    columns,
    features,
    getRowId: (template) => template.id,
  });

  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full min-w-3xl border-collapse text-sm [&_td]:align-middle [&_th]:align-middle">
        <thead className="bg-muted/70">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className="text-foreground px-4 py-3 text-left font-semibold"
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
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {templates.length === 0 && (
            <tr className="border-border border-t">
              <td
                colSpan={columns.length}
                className="text-muted-foreground px-4 py-10 text-center"
              >
                Chưa có mẫu cấu trúc đề thi.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
