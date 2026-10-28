import { Inbox } from "lucide-react";

/**
 * Trạng thái rỗng của mọi danh sách, theo KiotViet: vòng tròn xanh nhạt + hộp thư, "Không tìm thấy kết quả",
 * dòng mô tả; onWiden (nếu có) → "Nhấn vào đây để tiếp tục tìm kiếm" (mở rộng ra toàn thời gian).
 * what: danh từ trong câu mô tả ("giao dịch", "hàng hóa", "nhà cung cấp"...); period: "trong tháng này"...
 */
export function ListEmptyState({ what = "giao dịch", period, onWiden, compact }: {
  what?: string; period?: string; onWiden?: () => void; compact?: boolean;
}) {
  return (
    <div className={compact ? "py-8 text-center" : "py-20 text-center"}>
      <div className="mx-auto mb-4 flex size-[88px] items-center justify-center rounded-full bg-[#eef5fe]">
        <div className="flex size-14 items-center justify-center rounded-full bg-[#d7e8fc]"><Inbox className="size-8 text-primary" /></div>
      </div>
      <p className="font-semibold">Không tìm thấy kết quả</p>
      <p className="mt-1 text-muted-foreground">
        Không tìm thấy {what} nào phù hợp {period ?? (onWiden ? "trong tháng này" : "với điều kiện lọc")}.
        {onWiden && (
          <><br />Nhấn <button type="button" className="text-primary hover:underline" onClick={onWiden}>vào đây</button> để tiếp tục tìm kiếm.</>
        )}
      </p>
    </div>
  );
}
