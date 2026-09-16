import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { deleteTopic, editTopic } from "@/lib/services/topic.service";
import {
  deleteTopicSchema,
  topicIdSchema,
  updateTopicSchema,
} from "@/lib/validations/topic";
import type { ApiSuccessResponse } from "@/types/api";
import type { Topic } from "@/types/topic";

export const runtime = "nodejs";

interface TopicRouteContext {
  params: Promise<{ topicId: string }>;
}

export async function PATCH(request: Request, context: TopicRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const topicId = topicIdSchema.parse((await context.params).topicId);
    const input = await parseJsonRequest(request, updateTopicSchema);
    const topic = await editTopic(admin, topicId, input);
    const response = { data: { topic } } satisfies ApiSuccessResponse<{
      topic: Topic;
    }>;
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: TopicRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const topicId = topicIdSchema.parse((await context.params).topicId);
    const input = await parseJsonRequest(request, deleteTopicSchema);
    await deleteTopic(admin, topicId, input);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
