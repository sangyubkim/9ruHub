/**
 * 제품 기능 플래그.
 * 중국(1688) 소싱은 계정 제재·해외 가입 이슈로 기본 OFF.
 * 필요할 때만 NEXT_PUBLIC_SHOW_1688_UI=true
 */
export function show1688Ui(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_1688_UI === "true";
}
