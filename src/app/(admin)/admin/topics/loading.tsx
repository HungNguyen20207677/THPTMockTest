import { CurriculumTreeSkeleton } from "@/components/shared/loading-skeletons";

export default function TopicsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <CurriculumTreeSkeleton includeHeader />
    </main>
  );
}
