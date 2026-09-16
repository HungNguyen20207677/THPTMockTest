import { ManagementTableSkeleton } from "@/components/shared/loading-skeletons";

export default function ExamStructureTemplatesLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <ManagementTableSkeleton
        columns={6}
        label="Đang tải danh sách mẫu cấu trúc"
      />
    </main>
  );
}
