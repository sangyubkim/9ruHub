import * as XLSX from "xlsx";
import { createDraftFromUrl } from "@/lib/draft/create-from-url";

export type ExcelImportRowResult = {
  row: number;
  url: string;
  ok: boolean;
  draftId?: string;
  error?: string;
};

/**
 * 엑셀에서 url / asin 컬럼을 읽어 초안을 대량 생성
 */
export async function createDraftsFromExcel(buffer: ArrayBuffer | Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("엑셀 시트가 없습니다.");
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[sheetName],
    { defval: "" },
  );

  const results: ExcelImportRowResult[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const raw =
      row.url ??
      row.URL ??
      row.Url ??
      row.asin ??
      row.ASIN ??
      row.sourceUrl ??
      row["상품URL"];

    const url = String(raw ?? "").trim();
    if (!url) {
      results.push({ row: i + 2, url: "", ok: false, error: "URL/ASIN 비어 있음" });
      continue;
    }

    try {
      const draft = await createDraftFromUrl(url);
      results.push({ row: i + 2, url, ok: true, draftId: draft.id });
    } catch (error) {
      results.push({
        row: i + 2,
        url,
        ok: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    }
  }

  return {
    total: results.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

export function buildExcelTemplateBuffer(): Buffer {
  const sheet = XLSX.utils.json_to_sheet([
    { url: "https://www.amazon.com/dp/B0D1XD1ZV3", note: "예시 URL" },
    { url: "B09XYZABC1", note: "ASIN만 입력해도 됩니다" },
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "import");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
