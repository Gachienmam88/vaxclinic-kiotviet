/**
 * Dịch lỗi API theo `code` khi giao diện không phải tiếng Việt (namespace "errors", tải sẵn khi đổi ngôn ngữ).
 * Backend trả message tiếng Việt kèm code (BusinessException → ApiError). Quy ước trong errors.json:
 * - codes.<CODE>: message cố định → thay hẳn bằng bản dịch.
 * - codesWithDetail.<CODE>: message có chi tiết động (tên hàng, mã phiếu, số tiền…) → "bản dịch (message gốc)".
 * - Không có code trong file / chưa tải xong → giữ message của server.
 */
import { DEFAULT_LOCALE } from "./locales";
import { getActiveLocale, getLoadedMessages } from "./message-store";
import { lookupMessage } from "./translate";

export function translateApiError(code: string, serverMessage: string): string {
  const locale = getActiveLocale();
  if (locale === DEFAULT_LOCALE) return serverMessage;
  const tree = getLoadedMessages(locale, "errors");
  const exact = lookupMessage(tree, `codes.${code}`);
  if (exact) return exact;
  const generic = lookupMessage(tree, `codesWithDetail.${code}`);
  return generic ? `${generic} (${serverMessage})` : serverMessage;
}

/** Câu chung khi không có message (lỗi mạng, JSON hỏng…). */
export function genericErrorText(): string {
  const locale = getActiveLocale();
  if (locale === DEFAULT_LOCALE) return "Có lỗi xảy ra";
  return lookupMessage(getLoadedMessages(locale, "errors"), "fallback") ?? "Có lỗi xảy ra";
}

/** Lỗi kiểm tra dữ liệu (VALIDATION_FAILED): chi tiết từng trường vẫn là tiếng Việt từ server, thêm tiền tố đã dịch. */
export function translateValidationDetails(details: string): string {
  const locale = getActiveLocale();
  if (locale === DEFAULT_LOCALE) return details;
  const prefix = lookupMessage(getLoadedMessages(locale, "errors"), "codes.VALIDATION_FAILED");
  return prefix ? `${prefix}: ${details}` : details;
}
