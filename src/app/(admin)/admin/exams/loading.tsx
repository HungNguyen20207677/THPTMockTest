import { ManagementTableSkeleton } from "@/components/shared/loading-skeletons";

export default function ExamsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <ManagementTableSkeleton columns={5} label="Đang tải danh sách đề thi" />
    </main>
  );
}
