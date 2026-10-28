"use client";

import { Fragment } from "react";
import { formatMoney, formatNumber } from "@/lib/format";

/** Cột bảng báo cáo. money/qty: căn phải + định dạng số. */
export type ReportColumn<T> = {
  key: string; label: React.ReactNode; type?: "money" | "qty" | "text"; width?: number;
  value: (r: T) => string | number | null | undefined; render?: (r: T) => React.ReactNode;
};

/**
 * Dòng hiển thị: kind sum (dòng tổng nền be), group (dòng nhóm có ⊞/⊟), sub (dòng nhóm con), row (dòng thường).
 * level thụt lề cột đầu; children hiện khi expanded.
 */
export type ReportLine<T> = { id: string; kind: "sum" | "group" | "sub" | "row"; data: T; level?: 0 | 1 | 2; children?: ReportLine<T>[]; label?: React.ReactNode };

export const cellText = <T,>(c: ReportColumn<T>, r: T) => {
  const v = c.value(r);
  if (v === null || v === undefined || v === "") return "";
  if (c.type === "money") return formatMoney(v);
  if (c.type === "qty") return formatNumber(v);
  return String(v);
};

export function ReportTable<T>({ columns, lines, expanded, onToggle, empty = "Báo cáo không có dữ liệu" }: {
  columns: ReportColumn<T>[]; lines: ReportLine<T>[]; expanded?: Set<string>; onToggle?: (id: string) => void; empty?: string;
}) {
  const renderLine = (l: ReportLine<T>): React.ReactNode => {
    const open = expanded?.has(l.id) ?? false;
    const cls = l.kind === "sum" ? "rp-sum" : l.kind === "group" ? "rp-group" : l.kind === "sub" ? "rp-sub" : "";
    return (
      <Fragment key={l.id}>
        <tr className={cls}>
          {columns.map((c, i) => (
            <td key={c.key} className={[c.type && c.type !== "text" ? "r" : "", i === 0 && l.level ? `rp-l${l.level}` : ""].join(" ").trim() || undefined}>
              {i === 0 && l.children?.length ? (
                <span className="rp-toggle" role="button" tabIndex={0} aria-label={open ? "Thu gọn" : "Mở rộng"}
                  onClick={() => onToggle?.(l.id)} onKeyDown={(e) => e.key === "Enter" && onToggle?.(l.id)}>{open ? "−" : "+"}</span>) : null}
              {i === 0 && l.label !== undefined ? l.label : c.render ? c.render(l.data) : cellText(c, l.data)}
            </td>))}
        </tr>
        {open && l.children?.map(renderLine)}
      </Fragment>
    );
  };
  return (
    <table className="rp-table">
      <thead><tr>{columns.map((c) => <th key={c.key} className={c.type && c.type !== "text" ? "r" : undefined} style={c.width ? { width: c.width } : undefined}>{c.label}</th>)}</tr></thead>
      <tbody>
        {lines.length ? lines.map(renderLine) : <tr><td colSpan={columns.length} className="rp-empty">{empty}</td></tr>}
      </tbody>
    </table>
  );
}

/** Dữ liệu CSV từ cấu trúc dòng (mở hết các nhóm), dùng cho nút xuất file. */
export function linesToCsv<T>(columns: ReportColumn<T>[], lines: ReportLine<T>[]) {
  const out: (string | number)[][] = [];
  const walk = (l: ReportLine<T>) => {
    out.push(columns.map((c, i) => {
      if (i === 0 && typeof l.label === "string") return l.label;
      const v = c.value(l.data);
      return v === null || v === undefined ? "" : typeof v === "number" ? v : String(v);
    }));
    l.children?.forEach(walk);
  };
  lines.forEach(walk);
  return { header: columns.map((c) => (typeof c.label === "string" ? c.label : c.key)), rows: out };
}

/** Bảng không phụ thuộc kiểu dòng — để 1 màn chọn giữa nhiều bảng có kiểu dòng khác nhau. */
export type AnyTable = { columns: ReportColumn<unknown>[]; lines: ReportLine<unknown>[] };
export const asTable = <T,>(columns: ReportColumn<T>[], lines: ReportLine<T>[]) => ({ columns, lines }) as unknown as AnyTable;