import { StatisticsSkeleton } from "@/components/shared/loading-skeletons";

export default function ExamResultsLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <StatisticsSkeleton label="Đang tải thống kê đề thi" metricCount={8} />
    </main>
  );
}
