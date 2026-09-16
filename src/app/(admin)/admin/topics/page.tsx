import type { Metadata } from "next";

import { CurriculumManagement } from "@/components/admin/curriculum-management";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export const metadata: Metadata = { title: "Chủ đề & kiến thức" };

export default async function CurriculumPage() {
  await requirePageRole(USER_ROLE.ADMIN);
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <CurriculumManagement />
    </main>
  );
}
