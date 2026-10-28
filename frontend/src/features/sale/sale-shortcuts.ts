/**
 * Phím tắt màn bán hàng (như KiotViet "Phím tắt chức năng"). Hàm thuần: phím → thao tác, để kiểm thử được.
 * Phím F luôn chạy (kể cả đang gõ trong ô nhập). Phím thường (Home, ↑, ↓, Enter, Shift) chỉ chạy khi KHÔNG gõ trong ô
 * nhập chữ — trừ ô số lượng của dòng hàng (inQty), nơi ↑/↓/Enter/Shift/Home là thao tác trên dòng.
 */

export type SaleShortcutAction =
  | "NEW_INVOICE" | "TOGGLE_AUTO_PRINT" | "FOCUS_PRODUCT" | "FOCUS_CUSTOMER" | "TOGGLE_QTY_MODE" | "FOCUS_PAID" | "PAY"
  | "FULLSCREEN" | "EDIT_QTY" | "QTY_UP" | "QTY_DOWN" | "NEXT_LINE" | "PREV_LINE";

export type ShortcutKey = { key: string; shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean };
export type ShortcutContext = { typing: boolean; inQty: boolean };

const F_KEYS: Record<string, SaleShortcutAction> = {
  F1: "NEW_INVOICE", F2: "TOGGLE_AUTO_PRINT", F3: "FOCUS_PRODUCT", F4: "FOCUS_CUSTOMER", F6: "TOGGLE_QTY_MODE",
  F8: "FOCUS_PAID", F9: "PAY", F11: "FULLSCREEN",
};

const LINE_KEYS: Record<string, SaleShortcutAction> = {
  Home: "EDIT_QTY", ArrowUp: "QTY_UP", ArrowDown: "QTY_DOWN", Enter: "NEXT_LINE", Shift: "PREV_LINE",
};

export function resolveShortcut(e: ShortcutKey, ctx: ShortcutContext): SaleShortcutAction | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null; // Ctrl/Alt + phím: để trình duyệt xử lý
  const f = F_KEYS[e.key];
  if (f) return f;
  if (ctx.typing && !ctx.inQty) return null;
  return LINE_KEYS[e.key] ?? null;
}

/** Danh sách hiển thị trong ngăn "Phím tắt chức năng": [phím, khóa mô tả trong namespace sale — dịch lúc hiển thị]. */
export const SHORTCUT_HELP = [
  ["F1", "shortcuts.help.newInvoice"], ["F2", "shortcuts.help.autoPrint"], ["F3", "shortcuts.help.findProduct"],
  ["F4", "shortcuts.help.findCustomer"], ["F6", "shortcuts.help.qtyMode"], ["F8", "shortcuts.help.customerPaid"],
  ["F9", "shortcuts.help.pay"], ["F11", "shortcuts.help.fullscreen"], ["Home", "shortcuts.help.editQty"],
  ["↑", "shortcuts.help.qtyUp"], ["↓", "shortcuts.help.qtyDown"], ["Enter", "shortcuts.help.nextLine"],
  ["Shift", "shortcuts.help.prevLine"],
] as const;

/** Phần tử đang focus có phải ô nhập chữ (input/textarea/select/contenteditable)? */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || typeof (el as HTMLElement).tagName !== "string") return false;
  const h = el as HTMLElement;
  const tag = h.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || h.isContentEditable === true;
}
