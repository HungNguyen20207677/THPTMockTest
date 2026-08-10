import "server-only";

import { hash } from "bcryptjs";

import { USER_ROLE } from "@/lib/constants/roles";
import { PASSWORD_HASH_ROUNDS } from "@/lib/constants/user";
import {
  createUser,
  findUserByUsername,
  hasAdminUser,
} from "@/lib/db/dao/user.dao";
import { isMongoDuplicateKeyError } from "@/lib/db/errors";
import {
  AdminAlreadyExistsError,
  DuplicateUsernameError,
} from "@/lib/errors/app-error";
import { normalizeUsername } from "@/lib/utils/username";
import type { CreateInitialAdminInput } from "@/lib/validations/user";
import type { AppUser } from "@/types/user";

export async function createInitialAdmin(
  input: CreateInitialAdminInput,
): Promise<AppUser> {
  if (await hasAdminUser()) {
    throw new AdminAlreadyExistsError();
  }

  const username = normalizeUsername(input.username);

  if (await findUserByUsername(username)) {
    throw new DuplicateUsernameError();
  }

  const passwordHash = await hash(input.password, PASSWORD_HASH_ROUNDS);

  try {
    const user = await createUser({
      username,
      passwordHash,
      fullName: input.fullName.trim(),
      role: USER_ROLE.ADMIN,
      isActive: true,
    });

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    };
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      if (await hasAdminUser()) {
        throw new AdminAlreadyExistsError();
      }

      throw new DuplicateUsernameError();
    }

    throw error;
  }
}
