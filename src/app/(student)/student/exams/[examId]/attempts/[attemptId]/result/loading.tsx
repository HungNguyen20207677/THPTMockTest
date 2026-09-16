import { ResultDetailSkeleton } from "@/components/shared/loading-skeletons";

export default function AttemptResultLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <ResultDetailSkeleton label="Đang tải kết quả bài làm" />
    </main>
  );
}
