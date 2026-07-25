export type LocalizedOption = {
  name: string;
  values: string[];
  nameEn?: string;
};

const OPTION_NAME_KO: Record<string, string> = {
  color: "색상",
  colour: "색상",
  size: "사이즈",
  style: "스타일",
  material: "소재",
  pattern: "패턴",
  flavor: "맛",
  scent: "향",
  length: "길이",
  width: "너비",
  height: "높이",
  weight: "무게",
  capacity: "용량",
  pack: "구성",
  "pack of": "구성",
  quantity: "수량",
  option: "옵션",
  model: "모델",
  edition: "에디션",
  configuration: "구성",
  finish: "마감",
};

const VALUE_KO: Record<string, string> = {
  default: "기본",
  "one size": "프리사이즈",
  "onesize": "프리사이즈",
  black: "블랙",
  white: "화이트",
  red: "레드",
  blue: "블루",
  green: "그린",
  gray: "그레이",
  grey: "그레이",
  navy: "네이비",
  beige: "베이지",
  pink: "핑크",
  brown: "브라운",
  yellow: "옐로우",
  orange: "오렌지",
  purple: "퍼플",
  silver: "실버",
  gold: "골드",
  small: "S",
  medium: "M",
  large: "L",
  "x-large": "XL",
  "xx-large": "XXL",
  "extra large": "XL",
};

function localizeToken(value: string, map: Record<string, string>): string {
  const key = value.trim().toLowerCase();
  return map[key] ?? value.trim();
}

export function localizeOptionName(name: string): string {
  const cleaned = name.replace(/:$/, "").trim();
  return localizeToken(cleaned, OPTION_NAME_KO);
}

export function localizeOptionValue(value: string): string {
  return localizeToken(value, VALUE_KO);
}

export function localizeOptions(
  options: Array<{ name: string; values: string[] }>,
): LocalizedOption[] {
  return options.map((opt) => ({
    nameEn: opt.name,
    name: localizeOptionName(opt.name),
    values: opt.values.map(localizeOptionValue),
  }));
}
