"use client";

import {
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

import { IconAction } from "@/components/shared/icon-action";
import {
  getExamStructureQuestionCount,
  getExamStructureTotalScoreHundredths,
} from "@/lib/exam/structure";
import { scoreFormatter } from "@/lib/formatting";
import type { ExamStructureTemplate } from "@/types/exam-structure-template";

const questionTypeLabels = {
  SINGLE_CHOICE: "Trắc nghiệm",
  TRUE_FALSE: "Đúng/Sai",
  SHORT_ANSWER: "Trả lời ngắn",
  ESSAY_IMAGE: "Tự luận ảnh",
} as const;

const features = tableFeatures({});
const columnHelper = createColumnHelper<
  typeof features,
  ExamStructureTemplate
>();

interface ExamStructureTemplateTableProps {
  templates: ExamStructureTemplate[];
  isBusy: boolean;
  selectedIds: Set<string>;
  onToggleSelected: (templateId: string) => void;
  onToggleAll: () => void;
  onEdit: (template: ExamStructureTemplate, trigger: HTMLButtonElement) => void;
  onDelete: (
    template: ExamStructureTemplate,
    trigger: HTMLButtonElement,
  ) => void;
}

export function ExamStructureTemplateTable({
  templates,
  isBusy,
  selectedIds,
  onToggleSelected,
  onToggleAll,
  onEdit,
  onDelete,
}: ExamStructureTemplateTableProps) {
  const selectableTemplates = templates.filter(
    (template) => !template.isBuiltIn,
  );
  const allSelected =
    selectableTemplates.length > 0 &&
    selectableTemplates.every((template) => selectedIds.has(template.id));
  const someSelected = selectableTemplates.some((template) =>
    selectedIds.has(template.id),
  );
  const columns = columnHelper.columns([
    columnHelper.display({
      id: "select",
      header: () => (
        <input
          type="checkbox"
          className="accent-primary size-4"
          aria-label="Chọn tất cả mẫu tùy chỉnh trên trang hiện tại"
          aria-checked={someSelected && !allSelected ? "mixed" : allSelected}
          checked={allSelected}
          disabled={isBusy || selectableTemplates.length === 0}
          onChange={onToggleAll}
        />
      ),
      cell: ({ row }) =>
        row.original.isBuiltIn ? null : (
          <input
            type="checkbox"
            className="accent-primary size-4"
            aria-label={`Chọn mẫu cấu trúc ${row.original.name}`}
            checked={selectedIds.has(row.original.id)}
            disabled={isBusy}
            onChange={() => onToggleSelected(row.original.id)}
          />
        ),
    }),
    columnHelper.accessor("name", {
      header: "Tên mẫu",
      cell: ({ row, getValue }) => (
        <div className="min-w-52">
          <p className="font-semibold">{getValue()}</p>
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
            {row.original.sections
              .map(
                (section) =>
                  `${section.title} (${section.questions.length} câu)`,
              )
              .join(" · ")}
          </p>
        </div>
      ),
    }),
    columnHelper.accessor("isBuiltIn", {
      header: "Loại",
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
            Dựng sẵn
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-100">
            Tùy chỉnh
          </span>
        ),
    }),
    columnHelper.display({
      id: "structure",
      header: "Cấu trúc",
      cell: ({ row }) => (
        <div className="min-w-28 text-xs">
          <p className="font-medium">
            {row.original.sections.length} phần ·{" "}
            {getExamStructureQuestionCount(row.original)} câu
          </p>
          <div className="mt-1.5 flex max-w-52 flex-wrap gap-1">
            {Array.from(
              new Set(
                row.original.sections.flatMap((section) =>
                  section.questions.map((question) => question.type),
                ),
              ),
            ).map((type) => (
              <span
                key={type}
                className="bg-muted text-muted-foreground rounded px-1.5 py-0.5"
              >
                {questionTypeLabels[type]}
              </span>
            ))}
          </div>
        </div>
      ),
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
          <div className="flex min-w-20 items-center justify-end gap-1">
            <IconAction
              label={`Sửa mẫu cấu trúc ${template.name}`}
              icon="pencil"
              variant="outline"
              disabled={isBusy}
              onClick={(event) => onEdit(template, event.currentTarget)}
            />
            <IconAction
              label={`Xóa mẫu cấu trúc ${template.name}`}
              icon="trash-2"
              destructive
              disabled={isBusy}
              onClick={(event) => onDelete(template, event.currentTarget)}
            />
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
    <div className="border-border bg-card overflow-x-auto rounded-lg border shadow-xs">
      <table className="w-full min-w-[48rem] border-collapse text-sm [&_td]:align-middle [&_th]:align-middle">
        <thead className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className={`text-muted-foreground px-4 py-2.5 text-left text-xs font-semibold tracking-wide uppercase ${header.column.id === "actions" ? "text-right" : ""} ${header.column.id === "select" ? "w-12" : ""}`}
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
                <td key={cell.id} className="px-4 py-3.5">
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
