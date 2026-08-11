import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminAttemptDetailView } from "@/components/admin/admin-attempt-detail";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { attemptIdSchema } from "@/lib/validations/exam-attempt";

export const metadata: Metadata = {
  title: "Chi tiết lượt làm bài",
};

export default async function AdminResultDetailPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  await requirePageRole(USER_ROLE.ADMIN);
  const parsedAttemptId = attemptIdSchema.safeParse((await params).attemptId);

  if (!parsedAttemptId.success) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <AdminAttemptDetailView attemptId={parsedAttemptId.data} />
    </main>
  );
}
