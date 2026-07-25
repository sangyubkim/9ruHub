import { describe, expect, it } from "vitest";

/**
 * 스케줄러 본체는 DB 의존이므로, 배치 결과 집계 헬퍼 계약을 단위 검증한다.
 */
function summarize(items: Array<{ ok: boolean }>) {
  return {
    scanned: items.length,
    succeeded: items.filter((i) => i.ok).length,
    failed: items.filter((i) => !i.ok).length,
  };
}

describe("sync scheduler helpers", () => {
  it("성공/실패 건수를 집계한다", () => {
    expect(
      summarize([{ ok: true }, { ok: false }, { ok: true }]),
    ).toEqual({ scanned: 3, succeeded: 2, failed: 1 });
  });
});
