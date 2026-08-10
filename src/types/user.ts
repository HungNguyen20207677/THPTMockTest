import type { UserRole } from "@/lib/constants/roles";

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
}

export interface StudentAccount {
  id: string;
  username: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
