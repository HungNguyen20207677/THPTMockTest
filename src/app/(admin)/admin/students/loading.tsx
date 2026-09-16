import { ManagementTableSkeleton } from "@/components/shared/loading-skeletons";

export default function StudentsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <ManagementTableSkeleton
        columns={5}
        label="Đang tải danh sách học sinh"
      />
    </main>
  );
}
