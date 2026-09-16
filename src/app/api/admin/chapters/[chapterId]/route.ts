import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { deleteChapter, editChapter } from "@/lib/services/curriculum.service";
import {
  chapterIdSchema,
  deleteChapterSchema,
  updateChapterSchema,
} from "@/lib/validations/curriculum";
import type { ApiSuccessResponse } from "@/types/api";
import type { Chapter } from "@/types/curriculum";

export const runtime = "nodejs";

interface ChapterRouteContext {
  params: Promise<{ chapterId: string }>;
}

export async function PATCH(request: Request, context: ChapterRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const chapterId = chapterIdSchema.parse((await context.params).chapterId);
    const input = await parseJsonRequest(request, updateChapterSchema);
    const chapter = await editChapter(admin, chapterId, input);
    const response = { data: { chapter } } satisfies ApiSuccessResponse<{
      chapter: Chapter;
    }>;
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: ChapterRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const chapterId = chapterIdSchema.parse((await context.params).chapterId);
    const input = await parseJsonRequest(request, deleteChapterSchema);
    await deleteChapter(admin, chapterId, input);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
