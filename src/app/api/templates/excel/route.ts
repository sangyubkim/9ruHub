import { NextResponse } from "next/server";
import { buildExcelTemplateBuffer } from "@/lib/draft/create-from-excel";

export async function GET() {
  const buffer = buildExcelTemplateBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="sourcing-import-template.xlsx"',
    },
  });
}
