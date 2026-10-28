// Kiểm tra bộ dịch: mọi khóa của tiếng Việt (nguồn) phải có trong en/ja/zh, không thừa khóa, biến {name} khớp nhau,
// và hàm dịch (fallback / số nhiều / chèn biến). Chạy: node --experimental-strip-types --test tests/i18n-keys.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { interpolate, translateKey } from "../src/lib/i18n/translate.ts";

const MESSAGES = join(dirname(fileURLToPath(import.meta.url)), "../src/messages");
const TARGETS = ["en", "ja", "zh"];
const PLURAL = /_(zero|one|two|few|many|other)$/;

/** Cây JSON → Map<khóa (bỏ hậu tố số nhiều), tập biến {x}>. */
function flatten(tree, prefix = "", out = new Map()) {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix + k;
    if (typeof v === "string") {
      const base = key.replace(PLURAL, "");
      const vars = out.get(base) ?? new Set();
      for (const m of v.matchAll(/\{(\w+)\}/g)) if (m[1] !== "count") vars.add(m[1]);
      out.set(base, vars);
    } else if (v && typeof v === "object") flatten(v, key + ".", out);
    else assert.fail(`${key}: giá trị phải là chuỗi hoặc object`);
  }
  return out;
}

const read = (locale, file) => JSON.parse(readFileSync(join(MESSAGES, locale, file), "utf8"));
const namespaces = readdirSync(join(MESSAGES, "vi")).filter((f) => f.endsWith(".json"));

test("có ít nhất các namespace khung app", () => {
  for (const ns of ["common", "nav", "notifications", "auth", "errors"]) assert.ok(namespaces.includes(`${ns}.json`), ns);
});

for (const file of namespaces) {
  test(`namespace ${file}: en/ja/zh đủ khóa và biến như tiếng Việt`, () => {
    const vi = flatten(read("vi", file));
    for (const locale of TARGETS) {
      assert.ok(existsSync(join(MESSAGES, locale, file)), `thiếu file ${locale}/${file}`);
      const other = flatten(read(locale, file));
      const missing = [...vi.keys()].filter((k) => !other.has(k));
      const extra = [...other.keys()].filter((k) => !vi.has(k));
      assert.deepEqual(missing, [], `${locale}/${file} thiếu khóa`);
      assert.deepEqual(extra, [], `${locale}/${file} thừa khóa`);
      for (const [k, vars] of vi) {
        assert.deepEqual([...other.get(k)].sort(), [...vars].sort(), `${locale}/${file} "${k}": biến {…} khác tiếng Việt`);
      }
    }
  });
}

test("không có file ngôn ngữ khác mà tiếng Việt không có", () => {
  for (const locale of TARGETS) {
    for (const f of readdirSync(join(MESSAGES, locale))) assert.ok(namespaces.includes(f), `${locale}/${f} không có bản vi`);
  }
});

test("translateKey: ngôn ngữ → tiếng Việt → khóa; số nhiều; chèn biến", () => {
  const vi = { a: { b: "Xin chào {name}" }, items_other: "{count} mục", only: "Chỉ vi" };
  const en = { a: { b: "Hello {name}" }, items_one: "{count} item", items_other: "{count} items" };
  const missing = [];
  const t = (key, vars, messages = en) =>
    translateKey({ key, vars, htmlLang: "en", messages, fallback: vi, onMissing: (k) => missing.push(k) });
  assert.equal(t("a.b", { name: "An" }), "Hello An");
  assert.equal(t("items", { count: 1 }), "1 item");
  assert.equal(t("items", { count: 5 }), "5 items");
  assert.equal(t("only"), "Chỉ vi");
  assert.equal(t("nope"), "nope");
  assert.deepEqual(missing, ["only", "nope", "nope"]);
  assert.equal(t("items", { count: 2 }, vi), "2 mục");
  // namespace chưa tải xong (messages undefined) → tạm hiện tiếng Việt
  assert.equal(translateKey({ key: "a.b", vars: { name: "An" }, htmlLang: "en", messages: undefined, fallback: vi }), "Xin chào An");
  assert.equal(interpolate("{x} và {y}", { x: 1 }), "1 và {y}");
});
