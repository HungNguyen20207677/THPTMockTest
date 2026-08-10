import "server-only";

import mongoose from "mongoose";

import { getMongoDbUri } from "@/lib/env/server";

interface MongooseCache {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalForMongoose = globalThis as typeof globalThis & {
  __thptMongoose?: MongooseCache;
};

const cache = globalForMongoose.__thptMongoose ?? {
  connection: null,
  promise: null,
};

globalForMongoose.__thptMongoose = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.connection) {
    return cache.connection;
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(getMongoDbUri(), {
        bufferCommands: false,
      })
      .catch((error: unknown) => {
        cache.promise = null;
        throw error;
      });
  }

  cache.connection = await cache.promise;
  return cache.connection;
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
  cache.connection = null;
  cache.promise = null;
}
