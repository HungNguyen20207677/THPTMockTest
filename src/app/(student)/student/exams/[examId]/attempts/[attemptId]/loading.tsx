import { ExamWorkspaceSkeleton } from "@/components/shared/loading-skeletons";

export default function AttemptLoading() {
  return (
    <main className="mx-auto min-h-dvh max-w-[1920px] px-2 py-2 lg:h-dvh lg:overflow-clip">
      <ExamWorkspaceSkeleton />
    </main>
  );
}
