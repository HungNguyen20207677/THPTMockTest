import { CurriculumTreeSkeleton } from "@/components/shared/loading-skeletons";

export default function TopicsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <CurriculumTreeSkeleton includeHeader />
    </main>
  );
}
