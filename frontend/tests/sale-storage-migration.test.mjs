// Chuyển khóa localStorage cũ → "sale.*". Chạy: node --experimental-strip-types --test tests/sale-storage-migration.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { LEGACY_PREFIX, migrateLegacySaleStorage } from "../src/features/sale/sale-storage-migration.ts";

/** localStorage giả lập trong bộ nhớ (thứ tự khóa theo lúc chèn, giống trình duyệt). */
function memoryStorage(init = {}, { failSet = false } = {}) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (failSet) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}

const L = (s) => LEGACY_PREFIX + s;

test("chép mọi khóa cũ sang sale.* rồi xóa khóa cũ; khóa lạ giữ nguyên", () => {
  const s = memoryStorage({
    [L("catalog.b1")]: '{"products":[]}', [L("customers")]: "[1]", [L("tabs.u1")]: '{"tabs":[]}',
    [L("queue")]: '[{"id":"q1"}]', [L("lookups")]: "{}", [L("settings")]: '{"autoPrint":true}',
    [L("other")]: "x", "vx_store": "abc",
  });
  assert.equal(migrateLegacySaleStorage(s), 6);
  assert.deepEqual(s.dump(), {
    [L("other")]: "x", vx_store: "abc",
    "sale.catalog.b1": '{"products":[]}', "sale.customers": "[1]", "sale.tabs.u1": '{"tabs":[]}',
    "sale.queue": '[{"id":"q1"}]', "sale.lookups": "{}", "sale.settings": '{"autoPrint":true}',
  });
  assert.equal(migrateLegacySaleStorage(s), 0, "chạy lại vô hại");
});

test("khóa mới đã có → giữ giá trị mới, bỏ khóa cũ", () => {
  const s = memoryStorage({ [L("settings")]: '{"a":1}', "sale.settings": '{"a":2}' });
  migrateLegacySaleStorage(s);
  assert.deepEqual(s.dump(), { "sale.settings": '{"a":2}' });
});

test("hàng đợi offline có ở cả hai khóa → gộp theo id, không mất phiếu", () => {
  const s = memoryStorage({ [L("queue")]: '[{"id":"a"},{"id":"b"}]', "sale.queue": '[{"id":"b"},{"id":"c"}]' });
  migrateLegacySaleStorage(s);
  assert.deepEqual(JSON.parse(s.getItem("sale.queue")).map((x) => x.id), ["b", "c", "a"]);
  assert.equal(s.getItem(L("queue")), null);
});

test("hàng đợi hỏng / ghi lỗi → giữ khóa cũ để lần sau thử lại", () => {
  const broken = memoryStorage({ [L("queue")]: "not json", "sale.queue": "[]" });
  migrateLegacySaleStorage(broken);
  assert.equal(broken.getItem(L("queue")), "not json");

  const full = memoryStorage({ [L("queue")]: '[{"id":"a"}]' }, { failSet: true });
  assert.equal(migrateLegacySaleStorage(full), 0);
  assert.equal(full.getItem(L("queue")), '[{"id":"a"}]');
});
