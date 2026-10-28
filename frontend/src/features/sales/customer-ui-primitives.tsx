/**
 * Lớp CSS dùng chung cho các màn Khách hàng (chi tiết + popup) để khớp kích thước KiotViet.
 * Chỉ là hằng số chuỗi Tailwind + vài thành phần trình bày nhỏ, không chứa logic nghiệp vụ.
 */

/** TabsList dạng gạch chân, kéo hết chiều ngang, có đường kẻ dưới. */
export const kvTabsList = "w-full justify-start gap-6 border-b px-0 group-data-horizontal/tabs:h-10";
/** TabsTrigger: chữ 13px, tab đang chọn chữ xanh + gạch xanh 2px sát đường kẻ. */
export const kvTabsTrigger = "flex-none px-0 text-[13px] font-medium text-foreground data-active:text-primary after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px]";

/** Popup: bo 8px, không padding (header/body/footer tự canh). */
export const kvDialog = "gap-0 rounded-lg p-0";
export const kvDialogHeader = "px-5 pt-4 pb-3";
export const kvDialogTitle = "text-[16px] font-bold";
export const kvDialogBody = "space-y-3 px-5 pb-4";
export const kvDialogFooter = "mx-0 mb-0 rounded-b-lg border-t bg-white px-5 py-3";
/** Nút chân popup cao 32px. */
export const kvFooterBtn = "h-8 min-w-20 rounded-md px-4 text-[13px] font-semibold";

/** Ô nhập viền mảnh 32px trong popup công nợ. */
export const kvInput = "h-8 rounded-md border-[#d9dbe0] text-[13px] md:text-[13px]";
export const kvLabel = "text-[12px] font-normal text-foreground/80";

/** Bảng con trong chi tiết/popup: header nền #eff0f3, chữ đậm 12px. */
export const kvSubTable = "w-full text-[13px]";
export const kvSubHead = "bg-[#eff0f3] text-left text-[12px] font-bold [&_th]:h-[30px] [&_th]:px-2";
export const kvSubRow = "border-b border-[#e5e7eb] [&_td]:h-9 [&_td]:px-2";

/** Huy hiệu nhỏ "Nợ hiện tại: x" dưới tiêu đề popup. */
export function KvChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-[#eff0f3] px-1.5 py-0.5 text-[11px] font-semibold text-foreground">{children}</span>;
}
