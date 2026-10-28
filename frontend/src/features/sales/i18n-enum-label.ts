import type { Namespace, TFunction, MessageKey } from "@/lib/i18n";
import { lookupMessage, type MessageTree } from "@/lib/i18n/translate";

/**
 * Nhãn cho giá trị enum từ server: tra khóa "<group>.<value>" của namespace (VD "enums.paymentMethod.CASH").
 * Giá trị lạ (chưa có khóa) → trả nguyên giá trị thay vì hiện tên khóa. null/rỗng → "".
 */
export function enumLabel<T extends MessageTree>(t: TFunction<T>, ns: Namespace<T>, group: string, value: string | null | undefined): string {
  if (!value) return "";
  const key = `${group}.${value}`;
  return lookupMessage(ns.vi, key) === undefined ? value : t(key as MessageKey<T>);
}
