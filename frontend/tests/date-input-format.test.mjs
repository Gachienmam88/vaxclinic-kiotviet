// Kiểm tra chuyển đổi ngày/giờ của ô chọn ngày. Chạy: node --experimental-strip-types --test tests/date-input-format.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysYmd, addMonthsYmd, applyMask, dateTimeToDisplay, DATE_MASK, DATETIME_MASK, displayToDateTime, displayToYmd,
  monthMatrix, normalizeHm, TIME_MASK, toLocalDateTime, toYmd, ymdInRange, ymdToDisplay,
} from "../src/lib/date-input-format.ts";

test("ngày: yyyy-MM-dd ⇄ dd/MM/yyyy", () => {
  assert.equal(ymdToDisplay("2026-10-28"), "28/10/2026");
  assert.equal(ymdToDisplay("2026-10-28T10:00:00Z"), "28/10/2026");
  assert.equal(ymdToDisplay(""), "");
  assert.equal(ymdToDisplay(null), "");
  assert.equal(ymdToDisplay("2026-02-30"), "");
  assert.equal(displayToYmd("28/10/2026"), "2026-10-28");
  assert.equal(displayToYmd("1/2/2026"), "2026-02-01");
  assert.equal(displayToYmd("29/02/2024"), "2024-02-29");
  assert.equal(displayToYmd("29/02/2026"), null);
  assert.equal(displayToYmd("31/04/2026"), null);
  assert.equal(displayToYmd("28/13/2026"), null);
  assert.equal(displayToYmd("28/10/26"), null);
  assert.equal(displayToYmd("10/28/2026"), null);
});

test("giờ: HH:mm 24h", () => {
  assert.equal(normalizeHm("9:05"), "09:05");
  assert.equal(normalizeHm("23:59:00"), "23:59");
  assert.equal(normalizeHm("24:00"), null);
  assert.equal(normalizeHm("12:60"), null);
  assert.equal(normalizeHm(""), null);
});

test("ngày giờ: datetime-local ⇄ dd/MM/yyyy HH:mm", () => {
  assert.equal(dateTimeToDisplay("2026-10-28T22:28"), "28/10/2026 22:28");
  assert.equal(dateTimeToDisplay("2026-10-28T22:28:45"), "28/10/2026 22:28");
  assert.equal(dateTimeToDisplay(""), "");
  assert.equal(displayToDateTime("28/10/2026 22:28"), "2026-10-28T22:28");
  assert.equal(displayToDateTime("1/2/2026 7:05"), "2026-02-01T07:05");
  assert.equal(displayToDateTime("28/10/2026"), null);
  assert.equal(displayToDateTime("28/10/2026 25:00"), null);
  const iso = new Date(2026, 9, 28, 22, 28).toISOString();
  assert.equal(toLocalDateTime(iso), "2026-10-28T22:28");
  assert.equal(toLocalDateTime("abc"), null);
});

test("mặt nạ gõ phím", () => {
  assert.equal(applyMask("28102026", DATE_MASK), "28/10/2026");
  assert.equal(applyMask("2810", DATE_MASK), "28/10");
  assert.equal(applyMask("28/10", DATE_MASK), "28/10");
  assert.equal(applyMask("1/2/2026", DATE_MASK), "01/02/2026");
  assert.equal(applyMask("281020262228", DATETIME_MASK), "28/10/2026 22:28");
  assert.equal(applyMask("28/10/2026 22:28", DATETIME_MASK), "28/10/2026 22:28");
  assert.equal(applyMask("28/10/2026 22:2899", DATETIME_MASK), "28/10/2026 22:28");
  assert.equal(applyMask("930", TIME_MASK), "93:0");
  assert.equal(applyMask("9:30", TIME_MASK), "09:30");
  assert.equal(applyMask("ab", DATE_MASK), "");
});

test("lịch tháng: 6 tuần, bắt đầu Thứ 2", () => {
  const days = monthMatrix(2026, 9); // 10/2026, ngày 1 là Thứ 5
  assert.equal(days.length, 42);
  assert.equal(toYmd(days[0]), "2026-09-28");
  assert.equal(days[0].getDay(), 1);
  assert.equal(toYmd(days[3]), "2026-10-01");
  const june = monthMatrix(2026, 5); // 01/06/2026 là Thứ 2
  assert.equal(toYmd(june[0]), "2026-06-01");
});

test("cộng ngày/tháng, khoảng min-max", () => {
  assert.equal(addDaysYmd("2026-12-31", 1), "2027-01-01");
  assert.equal(addMonthsYmd("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonthsYmd("2026-01-15", -1), "2025-12-15");
  assert.ok(ymdInRange("2026-10-28", "2026-10-01", "2026-10-31"));
  assert.ok(!ymdInRange("2026-11-01", undefined, "2026-10-31"));
  assert.ok(ymdInRange("2026-11-01"));
});
