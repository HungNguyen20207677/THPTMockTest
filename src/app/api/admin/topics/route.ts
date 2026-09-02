import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { createTopic, listTopics } from "@/lib/services/topic.service";
import {
  createTopicSchema,
  listTopicsQuerySchema,
} from "@/lib/validations/topic";
import type { ApiSuccessResponse } from "@/types/api";
import type { Topic } from "@/types/topic";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const query = listTopicsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const topics = await listTopics(admin, query.q);
    const response = {
      data: { topics },
    } satisfies ApiSuccessResponse<{ topics: Topic[] }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const input = await parseJsonRequest(request, createTopicSchema);
    const { topic, created } = await createTopic(admin, input);
    const response = {
      data: { topic },
    } satisfies ApiSuccessResponse<{ topic: Topic }>;

    return NextResponse.json(response, { status: created ? 201 : 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
