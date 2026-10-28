// Kiểm tra danh mục ĐVHC tĩnh + hàm tìm không dấu. Chạy: node --experimental-strip-types --test tests/vn-admin-data.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { foldVietnamese, searchUnits, joinAddress, isProvinceCode, isWardCode } from "../src/lib/vn-admin-search.ts";

const data = JSON.parse(readFileSync(new URL("../public/data/vn-admin-2025.json", import.meta.url), "utf8"));

test("dataset counts: 34 tỉnh/thành, 3.321 phường/xã/đặc khu", () => {
  assert.equal(data.provinces.length, 34);
  assert.equal(data.wards.length, 3321);
  assert.deepEqual(data._meta.counts, { provinces: 34, wards: 3321 });
  const types = {};
  for (const w of data.wards) types[w.type] = (types[w.type] ?? 0) + 1;
  assert.equal(types["Đặc khu"], 13);
  assert.equal(types["Phường"] + types["Xã"] + types["Đặc khu"], 3321);
});

test("codes well-formed, unique, every ward references a valid province", () => {
  const pc = new Set(data.provinces.map((p) => p.code));
  assert.equal(pc.size, 34);
  assert.ok(data.provinces.every((p) => isProvinceCode(p.code) && p.name));
  const wc = new Set();
  for (const w of data.wards) {
    assert.ok(isWardCode(w.code), w.code);
    assert.ok(pc.has(w.provinceCode), `${w.code} → ${w.provinceCode}`);
    assert.ok(!wc.has(w.code), `duplicate ${w.code}`);
    wc.add(w.code);
  }
  for (const p of pc) assert.ok(data.wards.some((w) => w.provinceCode === p), `province ${p} has no ward`);
});

test("spot-check official codes (GSO)", () => {
  const p = Object.fromEntries(data.provinces.map((x) => [x.code, x.name]));
  const w = Object.fromEntries(data.wards.map((x) => [x.code, x]));
  assert.equal(p["01"], "Thành phố Hà Nội");
  assert.equal(p["79"], "Thành phố Hồ Chí Minh");
  assert.equal(p["96"], "Tỉnh Cà Mau");
  assert.equal(w["00004"].name, "Phường Ba Đình");
  assert.equal(w["26743"].name, "Phường Bến Thành");
  assert.equal(w["26743"].provinceCode, "79");
  assert.equal(w["31078"].name, "Đặc khu Phú Quốc");
});

test("foldVietnamese removes diacritics incl. đ", () => {
  assert.equal(foldVietnamese("  Thành phố  Đà Nẵng "), "thanh pho da nang");
  assert.equal(foldVietnamese("Phường Bến Thành"), foldVietnamese("phuong ben thanh"));
  assert.equal(foldVietnamese("M’Drắk"), "m'drak");
});

test("searchUnits: no-diacritic, multi-word, prefix first, by code, limit", () => {
  const hcm = data.wards.filter((w) => w.provinceCode === "79");
  assert.equal(searchUnits(hcm, "ben thanh")[0].code, "26743");
  assert.equal(searchUnits(data.provinces, "ho chi minh")[0].code, "79");
  assert.equal(searchUnits(data.provinces, "da nang")[0].name, "Thành phố Đà Nẵng");
  assert.equal(searchUnits(data.provinces, "01")[0].code, "01");
  assert.equal(searchUnits(hcm, "phuong sai gon")[0].code, "26740");
  assert.equal(searchUnits(data.wards, "", 10).length, 10);
  assert.equal(searchUnits(data.provinces, "khong-co-tinh-nay").length, 0);
});

test("joinAddress skips blanks", () => {
  assert.equal(joinAddress("12 Lê Lợi", "", null, "Phường Bến Thành", "Thành phố Hồ Chí Minh"),
    "12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh");
});
