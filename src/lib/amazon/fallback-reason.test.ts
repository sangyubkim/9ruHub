import { describe, expect, it } from "vitest";
import { amazonFallbackReasonMessage } from "@/lib/amazon/fetch-product";

describe("amazonFallbackReasonMessage", () => {
  it("explains robot block and paapi error", () => {
    expect(amazonFallbackReasonMessage("amazon_robot_block")).toContain(
      "PA-API",
    );
    expect(amazonFallbackReasonMessage("paapi_error")).toContain("PA-API");
  });
});
