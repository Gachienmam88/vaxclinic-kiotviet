import { Fragment, type ReactNode } from "react";

/**
 * Chèn phần tử React vào câu đã dịch: t("rename.summary") gọi KHÔNG truyền biến thì giữ nguyên "{from}" / "{to}",
 * hàm này thay từng "{tên}" bằng parts[tên] (VD chữ đậm) — giữ đúng thứ tự từ của từng ngôn ngữ.
 */
export function renderRichText(template: string, parts: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/g).map((chunk, i) => {
    const name = /^\{(\w+)\}$/.exec(chunk)?.[1];
    return <Fragment key={i}>{name && name in parts ? parts[name] : chunk}</Fragment>;
  });
}
