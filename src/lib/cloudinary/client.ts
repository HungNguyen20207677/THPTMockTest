import "server-only";

import { v2 as cloudinary } from "cloudinary";

import { getCloudinaryEnvironment } from "@/lib/env/server";

let isConfigured = false;

export function getCloudinaryClient(): typeof cloudinary {
  if (!isConfigured) {
    const environment = getCloudinaryEnvironment();

    cloudinary.config({
      cloud_name: environment.cloudName,
      api_key: environment.apiKey,
      api_secret: environment.apiSecret,
      secure: true,
    });

    isConfigured = true;
  }

  return cloudinary;
}
