"use client";

import {
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import Link from "next/link";

import { IconAction } from "@/components/shared/icon-action";
import type { StudentAccount } from "@/types/user";

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, StudentAccount>();
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeZone: "Asia/Ho_Chi_Minh",
});

interface StudentTableProps {
  students: StudentAccount[];
  isBusy: boolean;
  pendingStatusStudentId?: string | null;
  onEdit: (student: StudentAccount, trigger: HTMLButtonElement) => void;
  onResetPassword: (
    student: StudentAccount,
    trigger: HTMLButtonElement,
  ) => void;
  onToggleStatus: (student: StudentAccount) => void;
  onDelete: (student: StudentAccount, trigger: HTMLButtonElement) => void;
}

export function StudentTable({
  students,
  isBusy,
  pendingStatusStudentId,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onDelete,
}: StudentTableProps) {
  const columns = columnHelper.columns([
    columnHelper.accessor("fullName", {
      header: "Họ và tên",
      cell: ({ row, getValue }) => (
        <Link
          href={`/admin/students/${row.original.id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor("username", {
      header: "Tên đăng nhập",
      cell: ({ getValue }) => `@${getValue()}`,
    }),
    columnHelper.accessor("isActive", {
      header: "Trạng thái",
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
            Hoạt động
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-100">
            Đã khóa
          </span>
        ),
    }),
    columnHelper.accessor("createdAt", {
      header: "Ngày tạo",
      cell: ({ getValue }) => dateFormatter.format(new Date(getValue())),
    }),
    columnHelper.display({
      id: "actions",
      header: "Thao tác",
      cell: ({ row }) => {
        const student = row.original;
        const isStatusPending = pendingStatusStudentId === student.id;

        return (
          <div className="flex min-w-48 items-center justify-end gap-1">
            <IconAction
              href={`/admin/students/${student.id}`}
              label={`Xem kết quả của ${student.fullName}`}
              icon="eye"
              variant="outline"
            />
            <IconAction
              label={`Sửa tài khoản ${student.fullName}`}
              icon="pencil"
              disabled={isBusy}
              onClick={(event) => onEdit(student, event.currentTarget)}
            />
            <IconAction
              label={`Đổi mật khẩu cho ${student.fullName}`}
              icon="key-round"
              disabled={isBusy}
              onClick={(event) => onResetPassword(student, event.currentTarget)}
            />
            <IconAction
              label={`${isStatusPending ? (student.isActive ? "Đang khóa" : "Đang kích hoạt") : student.isActive ? "Khóa" : "Kích hoạt"} tài khoản ${student.fullName}`}
              icon={student.isActive ? "lock" : "lock-open"}
              variant="outline"
              disabled={isBusy}
              aria-busy={isStatusPending}
              onClick={() => onToggleStatus(student)}
            />
            <IconAction
              label={`Xóa tài khoản ${student.fullName}`}
              icon="trash-2"
              destructive
              disabled={isBusy}
              onClick={(event) => onDelete(student, event.currentTarget)}
            />
          </div>
        );
      },
    }),
  ]);
  const table = useTable({
    data: students,
    columns,
    features,
    getRowId: (student) => student.id,
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
                <td key={cell.id} className="px-4 py-3 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {students.length === 0 && (
            <tr className="border-border border-t">
              <td
                colSpan={columns.length}
                className="text-muted-foreground px-4 py-10 text-center"
              >
                Chưa có tài khoản học sinh.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
