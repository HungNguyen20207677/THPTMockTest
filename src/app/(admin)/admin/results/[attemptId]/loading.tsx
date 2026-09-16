import { ResultDetailSkeleton } from "@/components/shared/loading-skeletons";

export default function ResultDetailLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <ResultDetailSkeleton label="Đang tải chi tiết lượt làm bài" />
    </main>
  );
}
