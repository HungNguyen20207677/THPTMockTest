import { ExamFormSkeleton } from "@/components/shared/loading-skeletons";

export default function NewExamLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <ExamFormSkeleton includeHeader />
    </main>
  );
}
