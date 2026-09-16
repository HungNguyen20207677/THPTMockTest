import { ManagementTableSkeleton } from "@/components/shared/loading-skeletons";

export default function ResultsLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <ManagementTableSkeleton
        columns={8}
        label="Đang tải danh sách kết quả"
        filters
      />
    </main>
  );
}
