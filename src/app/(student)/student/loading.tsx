import { DashboardSkeleton } from "@/components/shared/loading-skeletons";

export default function StudentLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <DashboardSkeleton variant="student" />
    </main>
  );
}
