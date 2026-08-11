"use client";

import { useEffect, useState } from "react";

import { AdminResultTable } from "@/components/admin/result-table";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import { fetchExams } from "@/lib/api/exams";
import {
  fetchAdminResults,
  type AdminResultFilters,
} from "@/lib/api/reporting";
import { fetchStudents } from "@/lib/api/students";
import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import type { ExamSummary } from "@/types/exam";
import type { AdminResultList } from "@/types/reporting";
import type { StudentAccount } from "@/types/user";

interface AdminResultListPanelProps {
  studentId?: string;
  examId?: string;
  showFilters?: boolean;
}

function getRequestError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }

    return error.message;
  }

  return "Không thể tải danh sách kết quả. Vui lòng thử lại.";
}

export function AdminResultListPanel({
  studentId,
  examId,
  showFilters = false,
}: AdminResultListPanelProps) {
  const [data, setData] = useState<AdminResultList | null>(null);
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<
    "" | NonNullable<AdminResultFilters["status"]>
  >("");
  const [page, setPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [filterRefreshVersion, setFilterRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);

  useEffect(() => {
    if (!showFilters) {
      return;
    }

    let isCurrent = true;

    void Promise.all([fetchStudents(), fetchExams()])
      .then(([studentResponse, examResponse]) => {
        if (isCurrent) {
          setStudents(studentResponse.data.students);
          setExams(examResponse.data.exams);
          setFilterError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (isCurrent) {
          setFilterError(getRequestError(requestError));
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [filterRefreshVersion, showFilters]);

  useEffect(() => {
    let isCurrent = true;
    const filters: AdminResultFilters = {
      page,
      pageSize: 20,
      studentId: studentId ?? (selectedStudentId || undefined),
      examId: examId ?? (selectedExamId || undefined),
      status: selectedStatus || undefined,
    };

    void fetchAdminResults(filters)
      .then((response) => {
        if (isCurrent) {
          setData(response.data);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (isCurrent) {
          setError(getRequestError(requestError));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [
    examId,
    page,
    refreshVersion,
    selectedExamId,
    selectedStatus,
    selectedStudentId,
    studentId,
  ]);

  function resetPage() {
    setIsLoading(true);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="border-border bg-muted/30 grid gap-3 rounded-xl border p-4 md:grid-cols-4">
          {filterError && (
            <div className="border-destructive/30 bg-destructive/5 rounded-md border p-3 md:col-span-4">
              <p role="alert" className="text-destructive text-sm">
                {filterError}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() =>
                  setFilterRefreshVersion((version) => version + 1)
                }
              >
                Tải lại bộ lọc
              </Button>
            </div>
          )}
          <label className="space-y-1 text-sm">
            <span className="font-medium">Học sinh</span>
            <select
              className="border-input bg-background h-10 w-full rounded-md border px-3"
              value={selectedStudentId}
              onChange={(event) => {
                setSelectedStudentId(event.target.value);
                resetPage();
              }}
            >
              <option value="">Tất cả học sinh</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName} (@{student.username})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Đề thi</span>
            <select
              className="border-input bg-background h-10 w-full rounded-md border px-3"
              value={selectedExamId}
              onChange={(event) => {
                setSelectedExamId(event.target.value);
                resetPage();
              }}
            >
              <option value="">Tất cả đề thi</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Cách nộp</span>
            <select
              className="border-input bg-background h-10 w-full rounded-md border px-3"
              value={selectedStatus}
              onChange={(event) => {
                setSelectedStatus(
                  event.target.value as
                    "" | NonNullable<AdminResultFilters["status"]>,
                );
                resetPage();
              }}
            >
              <option value="">Tất cả</option>
              <option value={EXAM_ATTEMPT_STATUS.SUBMITTED}>Chủ động</option>
              <option value={EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED}>
                Tự động khi hết giờ
              </option>
            </select>
          </label>
          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              variant="outline"
              onClick={() => {
                if (
                  !selectedStudentId &&
                  !selectedExamId &&
                  !selectedStatus &&
                  page === 1
                ) {
                  return;
                }

                setIsLoading(true);
                setSelectedStudentId("");
                setSelectedExamId("");
                setSelectedStatus("");
                resetPage();
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <div className="border-border space-y-3 rounded-xl border p-5">
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsLoading(true);
              setRefreshVersion((version) => version + 1);
            }}
          >
            Thử lại
          </Button>
        </div>
      ) : isLoading && !data ? (
        <p
          className="text-muted-foreground py-8 text-center"
          aria-live="polite"
        >
          Đang tải danh sách kết quả...
        </p>
      ) : data ? (
        <>
          <AdminResultTable results={data.results} />
          <PaginationControls
            pagination={data.pagination}
            disabled={isLoading}
            onPageChange={(nextPage) => {
              setIsLoading(true);
              setPage(nextPage);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
