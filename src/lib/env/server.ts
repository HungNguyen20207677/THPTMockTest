import "server-only";

import { z } from "zod";

const requiredEnvironmentValue = z.string().trim().min(1);

function readRequiredEnvironmentValue(name: string): string {
  const result = requiredEnvironmentValue.safeParse(process.env[name]);

  if (!result.success) {
    throw new Error(`Missing or invalid environment variable: ${name}`);
  }

  return result.data;
}

export function getMongoDbUri(): string {
  return readRequiredEnvironmentValue("MONGODB_URI");
}

export interface CloudinaryEnvironment {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function getCloudinaryEnvironment(): CloudinaryEnvironment {
  return {
    cloudName: readRequiredEnvironmentValue("CLOUDINARY_CLOUD_NAME"),
    apiKey: readRequiredEnvironmentValue("CLOUDINARY_API_KEY"),
    apiSecret: readRequiredEnvironmentValue("CLOUDINARY_API_SECRET"),
  };
}
