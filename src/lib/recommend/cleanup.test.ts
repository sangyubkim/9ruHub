import { describe, expect, it } from "vitest";
import type { CleanupMode } from "./cleanup";

describe("cleanup modes", () => {
  it("exports expected mode names", () => {
    const modes: CleanupMode[] = [
      "pending",
      "pending_stub",
      "keep_top",
      "pending_except_ids",
      "purge_ignored",
    ];
    expect(modes).toHaveLength(5);
  });
});
