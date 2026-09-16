import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { createChapter, listChapters } from "@/lib/services/curriculum.service";
import {
  createChapterSchema,
  listChaptersQuerySchema,
} from "@/lib/validations/curriculum";
import type { ApiSuccessResponse } from "@/types/api";
import type { Chapter } from "@/types/curriculum";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const query = listChaptersQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const chapters = await listChapters(admin, query.gradeId);
    const response = { data: { chapters } } satisfies ApiSuccessResponse<{
      chapters: Chapter[];
    }>;
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const input = await parseJsonRequest(request, createChapterSchema);
    const chapter = await createChapter(admin, input);
    const response = { data: { chapter } } satisfies ApiSuccessResponse<{
      chapter: Chapter;
    }>;
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
