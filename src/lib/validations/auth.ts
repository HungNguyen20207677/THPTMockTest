import { z } from "zod";

import { loginPasswordSchema, usernameSchema } from "@/lib/validations/user";

export const credentialsSchema = z.object({
  username: usernameSchema,
  password: loginPasswordSchema,
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
