import "server-only";

import { compare } from "bcryptjs";

import { findUserById, findUserForAuthentication } from "@/lib/db/dao/user.dao";
import { normalizeUsername } from "@/lib/utils/username";
import type { CredentialsInput } from "@/lib/validations/auth";
import type { AppUser } from "@/types/user";

const DUMMY_PASSWORD_HASH =
  "$2b$12$uwfDJ1Hqi2weKVmpBFveMOFJKifTP3Q/yg2ViFXWUWRGu1jemW.m6";

export interface AuthenticatedAppUser extends AppUser {
  sessionVersion: number;
}

export async function authenticateUser(
  credentials: CredentialsInput,
): Promise<AuthenticatedAppUser | null> {
  const user = await findUserForAuthentication(
    normalizeUsername(credentials.username),
  );
  const passwordMatches = await compare(
    credentials.password,
    user?.isActive ? user.passwordHash : DUMMY_PASSWORD_HASH,
  );

  if (!user?.isActive || !passwordMatches) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}

export async function findActiveAuthUser(
  userId: string,
): Promise<AuthenticatedAppUser | null> {
  const user = await findUserById(userId);

  if (!user?.isActive) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}
