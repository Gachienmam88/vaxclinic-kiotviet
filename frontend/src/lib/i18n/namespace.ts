import type { MessageTree } from "./translate";

/**
 * Một namespace = 1 nhóm chuỗi (VD "settings") với 4 file src/messages/<locale>/<name>.json.
 * File tiếng Việt được import tĩnh ở chỗ khai báo (src/messages/<name>.ts) nên luôn có sẵn và là nguồn kiểu cho khóa:
 * t("khoa.sai") báo lỗi TypeScript. Các ngôn ngữ khác tải lười theo `name`.
 */
export type Namespace<T extends MessageTree = MessageTree> = { readonly name: string; readonly vi: T };

export function createNamespace<T extends MessageTree>(name: string, vi: T): Namespace<T> {
  return { name, vi };
}
