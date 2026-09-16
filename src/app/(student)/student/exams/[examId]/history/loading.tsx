import { StatisticsSkeleton } from "@/components/shared/loading-skeletons";

export default function AttemptHistoryLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <StatisticsSkeleton label="Đang tải lịch sử làm bài" metricCount={0} />
    </main>
  );
}
