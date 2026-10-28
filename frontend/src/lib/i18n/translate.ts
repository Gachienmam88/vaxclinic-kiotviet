/**
 * Phần thuần của i18n (không React): tra khóa dạng "a.b.c" trong cây message, chọn dạng số nhiều, chèn biến {name}.
 * Không import runtime để test node (--experimental-strip-types) chạy trực tiếp được.
 */

export type MessageTree = { [key: string]: string | MessageTree };
export type TranslateVars = Record<string, string | number>;

const PLURAL_SUFFIXES = ["zero", "one", "two", "few", "many", "other"] as const;
type PluralSuffix = (typeof PLURAL_SUFFIXES)[number];

/** Mọi đường dẫn lá của cây JSON: { a: { b: "x" } } → "a.b". */
type LeafPaths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : LeafPaths<T[K], `${P}${K}.`>;
}[keyof T & string];
/** Khóa số nhiều "items_one" / "items_other" được gọi bằng gốc "items" + { count }. */
type PluralBase<K> = K extends `${infer B}_${PluralSuffix}` ? B : never;
export type MessageKey<T> = LeafPaths<T> | PluralBase<LeafPaths<T>>;

export function lookupMessage(tree: MessageTree | undefined, key: string): string | undefined {
  let node: string | MessageTree | undefined = tree;
  for (const part of key.split(".")) {
    if (node == null || typeof node === "string") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

const pluralRulesCache = new Map<string, Intl.PluralRules>();
function pluralCategory(htmlLang: string, count: number): string {
  let rules = pluralRulesCache.get(htmlLang);
  if (!rules) {
    rules = new Intl.PluralRules(htmlLang);
    pluralRulesCache.set(htmlLang, rules);
  }
  return rules.select(count);
}

/** Khi có vars.count kiểu số: thử "key_<dạng số nhiều>" → "key_other" → "key". */
export function resolveMessage(tree: MessageTree | undefined, key: string, htmlLang: string, vars?: TranslateVars) {
  if (typeof vars?.count === "number") {
    return lookupMessage(tree, `${key}_${pluralCategory(htmlLang, vars.count)}`)
      ?? lookupMessage(tree, `${key}_other`)
      ?? lookupMessage(tree, key);
  }
  return lookupMessage(tree, key);
}

/** "Xin chào {name}" + { name: "An" } → "Xin chào An". Biến thiếu giữ nguyên "{name}" để dễ phát hiện. Số giữ dạng thô. */
export function interpolate(message: string, vars?: TranslateVars): string {
  if (!vars) return message;
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/**
 * Dịch 1 khóa: ngôn ngữ hiện tại → tiếng Việt (nguồn) → chính khóa (kèm tên namespace để dễ tìm).
 * onMissing được gọi khi phải rơi về tiếng Việt / khóa (để log 1 lần ở dev).
 */
export function translateKey(opts: {
  key: string;
  vars?: TranslateVars;
  htmlLang: string;
  messages: MessageTree | undefined;
  fallback: MessageTree;
  onMissing?: (key: string) => void;
}): string {
  const { key, vars, htmlLang, messages, fallback, onMissing } = opts;
  let message = messages === fallback ? undefined : resolveMessage(messages, key, htmlLang, vars);
  if (message === undefined) {
    message = resolveMessage(fallback, key, "vi", vars);
    if (messages !== fallback) onMissing?.(key);
  }
  if (message === undefined) {
    onMissing?.(key);
    return key;
  }
  return interpolate(message, vars);
}
