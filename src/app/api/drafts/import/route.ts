import { NextResponse } from "next/server";
import { createDraftsFromExcel } from "@/lib/draft/create-from-excel";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file 필드가 필요합니다." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await createDraftsFromExcel(buffer);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "엑셀 가져오기 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
