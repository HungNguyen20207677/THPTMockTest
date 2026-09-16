import { ManagementTableSkeleton } from "@/components/shared/loading-skeletons";

export default function ExamsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <ManagementTableSkeleton columns={7} label="Đang tải danh sách đề thi" />
    </main>
  );
}
