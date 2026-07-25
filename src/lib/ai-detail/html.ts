/** HTML 텍스트 이스케이프 (속성·본문 공통) */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const ALLOWED_TAGS =
  /^(section|h2|h3|h4|p|ul|ol|li|a|img|strong|em|br|div|span|table|thead|tbody|tr|th|td)$/i;

/**
 * GPT/템플릿 HTML에서 위험 요소를 제거하고 허용 태그만 남긴다.
 * 완전 sanitizer는 아니며, script/이벤트/javascript: 를 차단하는 방어 계층.
 */
export function sanitizeDetailHtml(html: string): string {
  let out = html.trim();
  if (!out) return "";

  // script / style 블록 제거
  out = out.replace(/<\/?(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
  out = out.replace(/<\/?(script|style)[^>]*\/?>/gi, "");

  // on* 이벤트 핸들러 제거
  out = out.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // javascript: URL 차단
  out = out.replace(
    /\s(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi,
    ' $1="#"',
  );

  // 허용되지 않는 태그 제거(내용은 유지)
  out = out.replace(/<\/?([a-z0-9-]+)(\s[^>]*)?>/gi, (match, tag: string) => {
    if (ALLOWED_TAGS.test(tag)) return match;
    return "";
  });

  return out.trim();
}
