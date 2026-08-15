"use client";

import {
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import Link from "next/link";

import { Button } from "@/components/ui/button";
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
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
            Hoạt động
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
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

        return (
          <div className="flex min-w-72 flex-wrap items-center gap-1">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/students/${student.id}`}>Kết quả</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isBusy}
              aria-label={`Sửa tài khoản ${student.fullName}`}
              onClick={(event) => onEdit(student, event.currentTarget)}
            >
              Sửa
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isBusy}
              aria-label={`Đổi mật khẩu cho ${student.fullName}`}
              onClick={(event) => onResetPassword(student, event.currentTarget)}
            >
              Đổi mật khẩu
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBusy}
              aria-label={`${student.isActive ? "Khóa" : "Kích hoạt"} tài khoản ${student.fullName}`}
              onClick={() => onToggleStatus(student)}
            >
              {student.isActive ? "Khóa" : "Kích hoạt"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isBusy}
              aria-label={`Xóa tài khoản ${student.fullName}`}
              onClick={(event) => onDelete(student, event.currentTarget)}
            >
              Xóa
            </Button>
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
