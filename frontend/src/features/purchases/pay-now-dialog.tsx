"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

/**
 * Lưu tạm phiếu nhập có "Tiền trả nhà cung cấp" > 0: hỏi có lưu phiếu chi ngay không.
 * Có → phiếu chi PC{mã} lập ngay (gắn phiếu tạm); Không → tiền trả giữ trên phiếu tạm, phiếu chi lập lúc Hoàn thành.
 */
export function PayNowDialog({ amount, onAnswer, onClose }: { amount: number; onAnswer: (payNow: boolean) => void; onClose: () => void }) {
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-lg p-5 sm:max-w-md">
        <DialogHeader><DialogTitle className="text-base font-bold">{t("kv.payNowTitle")}</DialogTitle></DialogHeader>
        <p className="text-[13px]">{t("kv.payNowQuestion", { amount: formatMoney(amount) })}</p>
        <DialogFooter className="-mx-5 -mb-5 rounded-b-lg bg-background px-5 py-3">
          <Button variant="outline" className="h-8 rounded-md px-3" onClick={() => onAnswer(false)}>{tc("actions.no")}</Button>
          <Button className="h-8 rounded-md px-4" onClick={() => onAnswer(true)}>{tc("actions.yes")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
