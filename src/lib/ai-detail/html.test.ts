import { describe, expect, it } from "vitest";
import { escapeHtml, sanitizeDetailHtml } from "@/lib/ai-detail/html";

describe("ai-detail html", () => {
  it("escapes special characters", () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe(
      "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;",
    );
  });

  it("strips script tags and event handlers", () => {
    const dirty = `
<section>
  <h2 onclick="alert(1)">제목</h2>
  <script>alert(1)</script>
  <p>본문</p>
  <a href="javascript:alert(1)">링크</a>
</section>`;
    const clean = sanitizeDetailHtml(dirty);
    expect(clean).toContain("<h2");
    expect(clean).toContain("본문");
    expect(clean).not.toMatch(/script/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).not.toMatch(/javascript:/i);
  });
});
