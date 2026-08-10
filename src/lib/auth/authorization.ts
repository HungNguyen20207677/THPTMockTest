import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ROLE_HOME, type UserRole } from "@/lib/constants/roles";
import {
  AuthenticationRequiredError,
  ForbiddenError,
} from "@/lib/errors/app-error";
import type { AppUser } from "@/types/user";

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const session = await auth();

  if (!session?.user.id) {
    return null;
  }

  return session.user;
});

export async function requirePageRole(role: UserRole): Promise<AppUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== role) {
    redirect(ROLE_HOME[user.role]);
  }

  return user;
}

export async function requireApiRole(role: UserRole): Promise<AppUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  if (user.role !== role) {
    throw new ForbiddenError();
  }

  return user;
}
