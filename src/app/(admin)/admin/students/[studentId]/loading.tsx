import { StatisticsSkeleton } from "@/components/shared/loading-skeletons";

export default function StudentDetailLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <StatisticsSkeleton label="Đang tải thống kê học sinh" metricCount={6} />
    </main>
  );
}
