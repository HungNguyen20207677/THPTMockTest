import "server-only";

import { z } from "zod";

const requiredEnvironmentValue = z.string().trim().min(1);
const mongoDbUriSchema = requiredEnvironmentValue
  .refine(
    (value) => /^mongodb(?:\+srv)?:\/\//.test(value),
    "MongoDB URI must use mongodb:// or mongodb+srv://.",
  )
  .refine((value) => {
    const authorityStart = value.indexOf("://") + 3;
    const pathStart = value.indexOf("/", authorityStart);
    const queryStart = value.indexOf("?", pathStart);
    const databaseName = value.slice(
      pathStart + 1,
      queryStart === -1 ? undefined : queryStart,
    );

    return pathStart >= authorityStart && databaseName.length > 0;
  }, "MongoDB URI must include a database name.");
const cloudinaryValueSchema = requiredEnvironmentValue.refine(
  (value) => !value.startsWith("replace-with-"),
  "Placeholder values are not allowed.",
);

function readEnvironmentValue(
  name: string,
  schema: z.ZodType<string> = requiredEnvironmentValue,
): string {
  const result = schema.safeParse(process.env[name]);

  if (!result.success) {
    throw new Error(`Missing or invalid environment variable: ${name}`);
  }

  return result.data;
}

export function getMongoDbUri(): string {
  return readEnvironmentValue("MONGODB_URI", mongoDbUriSchema);
}

export interface CloudinaryEnvironment {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function getCloudinaryEnvironment(): CloudinaryEnvironment {
  return {
    cloudName: readEnvironmentValue(
      "CLOUDINARY_CLOUD_NAME",
      cloudinaryValueSchema,
    ),
    apiKey: readEnvironmentValue("CLOUDINARY_API_KEY", cloudinaryValueSchema),
    apiSecret: readEnvironmentValue(
      "CLOUDINARY_API_SECRET",
      cloudinaryValueSchema,
    ),
  };
}

export function getOptionalAuthEnvironment(): {
  secret?: string;
  trustHost?: boolean;
} {
  const rawSecret = process.env.AUTH_SECRET?.trim();
  const rawTrustHost = process.env.AUTH_TRUST_HOST?.trim().toLowerCase();

  if (
    process.env.AUTH_SECRET !== undefined &&
    (!rawSecret ||
      rawSecret.length < 32 ||
      rawSecret.startsWith("replace-with-"))
  ) {
    throw new Error("Missing or invalid environment variable: AUTH_SECRET");
  }

  if (
    rawTrustHost !== undefined &&
    rawTrustHost !== "true" &&
    rawTrustHost !== "false"
  ) {
    throw new Error("Missing or invalid environment variable: AUTH_TRUST_HOST");
  }

  return {
    secret: rawSecret || undefined,
    trustHost: rawTrustHost === undefined ? undefined : rawTrustHost === "true",
  };
}
