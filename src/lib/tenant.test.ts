import { describe, expect, it } from "vitest";
import {
  DEMO_TENANT_SLUG,
  DEMO_USER_EMAIL,
} from "@/lib/tenant-constants";

describe("tenant constants", () => {
  it("uses stable demo identifiers for SaaS bootstrap", () => {
    expect(DEMO_TENANT_SLUG).toBe("demo");
    expect(DEMO_USER_EMAIL).toContain("@");
  });
});
