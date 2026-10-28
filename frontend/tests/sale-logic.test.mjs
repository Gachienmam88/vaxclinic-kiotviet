// Logic thuần của màn bán hàng: gợi ý tiền khách đưa, phím tắt, thiết lập, đọc + ghép file import hóa đơn.
// Chạy: node --experimental-strip-types --test tests/sale-logic.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { suggestedAmounts } from "../src/features/sale/sale-suggested-amounts.ts";
import { resolveShortcut, isTypingTarget } from "../src/features/sale/sale-shortcuts.ts";
import { mergeSettings, DEFAULT_SALE_SETTINGS } from "../src/features/sale/sale-settings.ts";
import { IMPORT_COLUMNS, parseCellNumber, parseImportSheets } from "../src/features/sale/sale-import-parse.ts";
import { mapImportRows, matchAdminUnits } from "../src/features/sale/sale-import-map.ts";
import { foldVietnamese } from "../src/lib/vn-admin-search.ts";

test("suggestedAmounts: như KiotViet 978,000 → 978,000 · 980,000 · 1,000,000", () => {
  assert.deepEqual(suggestedAmounts(978_000), [978_000, 980_000, 1_000_000]);
  assert.deepEqual(suggestedAmounts(320_000), [320_000, 350_000, 400_000, 500_000, 1_000_000]);
  assert.deepEqual(suggestedAmounts(1_000_000), [1_000_000]);
  assert.deepEqual(suggestedAmounts(0), []);
  assert.deepEqual(suggestedAmounts(-5), []);
  assert.deepEqual(suggestedAmounts(12_345.4), [12_345, 20_000, 50_000, 100_000, 200_000, 500_000]);
});

test("resolveShortcut: phím F chạy cả khi đang gõ; phím dòng chỉ khi không gõ hoặc ở ô số lượng", () => {
  const free = { typing: false, inQty: false }, typing = { typing: true, inQty: false }, qty = { typing: true, inQty: true };
  assert.equal(resolveShortcut({ key: "F9" }, typing), "PAY");
  assert.equal(resolveShortcut({ key: "F1" }, free), "NEW_INVOICE");
  assert.equal(resolveShortcut({ key: "F2" }, free), "TOGGLE_AUTO_PRINT");
  assert.equal(resolveShortcut({ key: "F3" }, typing), "FOCUS_PRODUCT");
  assert.equal(resolveShortcut({ key: "F4" }, free), "FOCUS_CUSTOMER");
  assert.equal(resolveShortcut({ key: "F6" }, free), "TOGGLE_QTY_MODE");
  assert.equal(resolveShortcut({ key: "F8" }, free), "FOCUS_PAID");
  assert.equal(resolveShortcut({ key: "F11" }, free), "FULLSCREEN");
  assert.equal(resolveShortcut({ key: "F7" }, free), null); // két tiền: không hỗ trợ
  assert.equal(resolveShortcut({ key: "F10", ctrlKey: true }, free), null);
  assert.equal(resolveShortcut({ key: "ArrowUp" }, free), "QTY_UP");
  assert.equal(resolveShortcut({ key: "ArrowDown" }, qty), "QTY_DOWN");
  assert.equal(resolveShortcut({ key: "ArrowUp" }, typing), null); // đang gõ ô tìm hàng: mũi tên để chọn kết quả
  assert.equal(resolveShortcut({ key: "Enter" }, qty), "NEXT_LINE");
  assert.equal(resolveShortcut({ key: "Enter" }, typing), null);
  assert.equal(resolveShortcut({ key: "Shift", shiftKey: true }, free), "PREV_LINE");
  assert.equal(resolveShortcut({ key: "Shift", shiftKey: true }, typing), null); // gõ chữ hoa không bị cướp phím
  assert.equal(resolveShortcut({ key: "Home" }, free), "EDIT_QTY");
  assert.equal(resolveShortcut({ key: "a" }, free), null);
  assert.equal(isTypingTarget({ tagName: "INPUT" }), true);
  assert.equal(isTypingTarget({ tagName: "DIV", isContentEditable: false }), false);
  assert.equal(isTypingTarget(null), false);
});

test("mergeSettings: bản lưu thiếu / sai kiểu → mặc định; số bản in kẹp 1..10", () => {
  assert.deepEqual(mergeSettings(null), DEFAULT_SALE_SETTINGS);
  const s = mergeSettings({ autoPrint: true, printCopies: 99, showCode: "yes", unknown: 1 });
  assert.equal(s.autoPrint, true);
  assert.equal(s.printCopies, 10);
  assert.equal(s.showCode, true);
  assert.equal("unknown" in s, false);
  assert.equal(mergeSettings({ printCopies: 0 }).printCopies, 1);
});

test("parseCellNumber: số, 978,000, 978.000, 12,5, rỗng, sai", () => {
  assert.equal(parseCellNumber(978000), 978000);
  assert.equal(parseCellNumber("978,000"), 978000);
  assert.equal(parseCellNumber("1.250.000"), 1250000);
  assert.equal(parseCellNumber("12,5"), 12.5);
  assert.equal(parseCellNumber(""), null);
  assert.ok(Number.isNaN(parseCellNumber("abc")));
});

const header = [...IMPORT_COLUMNS];
const sheet = (name, rows) => ({ name, rows: [header, ...rows] });

test("parseImportSheets: mỗi trang tính 1 giao dịch, lỗi theo dòng, giới hạn 19 trang tính / 250 dòng", () => {
  const r = parseImportSheets([
    sheet("HD1", [["SP01", "Vắc xin A", "978,000", "", "10", 2, "", "", "KH01", "Nguyễn A", "0901", "Công ty", "1 Lê Lợi", "Hà Nội", "Ba Đình"],
      ["SP02", "", "", 5000, "", "0"], ["", "x"], ["SP03", "", "-1", "", "", 1]]),
    sheet("Trống", [[], ["", ""]]),
    { name: "Sai", rows: [["Mã", "Tên"], ["SP01"]] },
    sheet("Dài", Array.from({ length: 251 }, () => ["SP01", "", "", "", "", 1])),
  ]);
  assert.equal(r.errors.length, 0);
  assert.equal(r.sheets.length, 3); // trang tính trống bị bỏ qua
  const [a, bad, long] = r.sheets;
  assert.equal(a.rows.length, 1);
  assert.deepEqual(a.rows[0], { row: 2, code: "SP01", name: "Vắc xin A", price: 978000, discount: null, discountPercent: 10, quantity: 2, lot: "", expiry: "" });
  assert.deepEqual(a.customer, { code: "KH01", name: "Nguyễn A", phone: "0901", type: "COMPANY", address: "1 Lê Lợi", area: "Hà Nội", ward: "Ba Đình" });
  assert.deepEqual(a.errors, ["Dòng 3: Số lượng phải lớn hơn 0", "Dòng 4: thiếu Mã hàng", "Dòng 5: Đơn giá không hợp lệ"]);
  assert.match(bad.errors[0], /Sai tiêu đề cột 1/);
  assert.match(long.errors[0], /251 dòng, tối đa 250/);
  const many = parseImportSheets(Array.from({ length: 20 }, (_, i) => sheet(`S${i}`, [["SP01", "", "", "", "", 1]])));
  assert.deepEqual(many, { sheets: [], errors: ["File có 20 trang tính, tối đa 19"] });
});

test("mapImportRows: mã đơn vị / mã vạch, giá trống = giá bán, giảm % ưu tiên, hàng không có → lỗi", () => {
  const catalog = [{ id: "p1", name: "Vắc xin A", lotManaged: true, stock: 5, taxCode: null,
    units: [{ id: "u1", code: "SP01", barcode: "893", unitName: "Liều", conversionRate: 1, price: 500_000 },
      { id: "u2", code: "SP01-H", barcode: null, unitName: "Hộp", conversionRate: 10, price: 4_500_000 }] }];
  const rows = [
    { row: 2, code: "sp01", name: "", price: null, discount: 20_000, discountPercent: null, quantity: 1, lot: "", expiry: "" },
    { row: 3, code: "893", name: "", price: 400_000, discount: 5, discountPercent: 10, quantity: 2, lot: "", expiry: "" },
    { row: 4, code: "SP01-H", name: "", price: 100, discount: 1000, discountPercent: null, quantity: 1, lot: "", expiry: "" },
    { row: 5, code: "XX", name: "", price: null, discount: null, discountPercent: null, quantity: 1, lot: "", expiry: "" },
  ];
  const r = mapImportRows(rows, catalog, foldVietnamese);
  assert.deepEqual(r.lines.map((l) => [l.unit.id, l.quantity, l.unitPrice, l.discount]),
    [["u1", 1, 500_000, 20_000], ["u1", 2, 400_000, 40_000], ["u2", 1, 100, 100]]);
  assert.deepEqual(r.errors, ["Dòng 5: không tìm thấy hàng hóa mã XX"]);
});

test("matchAdminUnits: tên có / không tiền tố, sai tên → lỗi", () => {
  const data = JSON.parse(readFileSync(new URL("../public/data/vn-admin-2025.json", import.meta.url), "utf8"));
  const admin = { provinces: data.provinces, wardsOf: (c) => data.wards.filter((w) => w.provinceCode === c) };
  assert.deepEqual(matchAdminUnits(admin, "Hà Nội", "Ba Đình", foldVietnamese),
    { provinceCode: "01", provinceName: "Thành phố Hà Nội", wardCode: "00004", wardName: "Phường Ba Đình" });
  assert.deepEqual(matchAdminUnits(admin, "thanh pho ha noi", "", foldVietnamese),
    { provinceCode: "01", provinceName: "Thành phố Hà Nội", wardCode: "", wardName: "" });
  assert.equal(matchAdminUnits(admin, "", "", foldVietnamese), null);
  assert.match(matchAdminUnits(admin, "Hà Tây", "", foldVietnamese).error, /Khu vực "Hà Tây"/);
  assert.match(matchAdminUnits(admin, "Hà Nội", "Không Có", foldVietnamese).error, /Phường xã "Không Có"/);
});

test("splitPayments: tiền thừa bớt ở tiền mặt trước, rồi phương thức chính", async () => {
  const { splitPayments } = await import("../src/features/sale/sale-payment-split.ts");
  assert.deepEqual(splitPayments({ paymentMethod: "CASH", extraPayments: [] }, 500_000, 478_000), { primary: 478_000, extras: [] });
  assert.deepEqual(splitPayments({ paymentMethod: "TRANSFER", extraPayments: [{ method: "CASH", amount: 50_000 }] }, 130_000, 100_000),
    { primary: 80_000, extras: [{ method: "CASH", amount: 20_000 }] });
  assert.deepEqual(splitPayments({ paymentMethod: "CASH", extraPayments: [{ method: "CARD", amount: 300_000 }] }, 1_000_000, 978_000),
    { primary: 678_000, extras: [{ method: "CARD", amount: 300_000 }] });
  assert.deepEqual(splitPayments({ paymentMethod: "CASH", extraPayments: [{ method: "TRANSFER", amount: 100_000 }] }, 100_000, 100_000),
    { primary: 0, extras: [{ method: "TRANSFER", amount: 100_000 }] });
});
