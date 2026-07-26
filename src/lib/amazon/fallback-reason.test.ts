import { describe, expect, it } from "vitest";
import { amazonFallbackReasonMessage } from "@/lib/amazon/fetch-product";

describe("amazonFallbackReasonMessage", () => {
  it("explains robot block", () => {
    expect(amazonFallbackReasonMessage("amazon_robot_block")).toContain(
      "로봇",
    );
  });
});
