"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Lock, LockOpen, PencilLine, SquarePen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBranches } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { SupplierConfirmDialog } from "./supplier-confirm-dialog";
import { SupplierFormDialog } from "./supplier-form-dialog";
import { useInvalidateSuppliers } from "./supplier-queries";
import type { SupplierRow } from "./supplier-types";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

/** Ô thông tin gạch chân; trống → "Chưa có". */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const t = useT(purchasesNs);
  return (
    <div className="space-y-1.5">
      <div className="text-[12px] text-foreground/80">{label}</div>
      <div className="min-h-7 border-b border-[#e5e7eb] pb-1.5 text-[13px]">{value || <span className="text-muted-foreground">{t("suppliers.info.notYet")}</span>}</div>
    </div>
  );
}

const btn = "h-8 rounded-md px-3 text-[13px] font-semibold";
type Confirm = "deactivate" | "delete" | null;

/** Tab "Thông tin": tên + mã, chi nhánh, người tạo | ngày tạo | nhóm, liên hệ, xuất hóa đơn, ghi chú sửa nhanh, nút thao tác. */
export function SupplierDetailInfoTab({ s, onDeleted }: { s: SupplierRow; onDeleted: () => void }) {
  const { data: branches = [] } = useBranches();
  const { can } = useCurrentUser();
  const manage = can("inventory.manage");
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const invalidate = useInvalidateSuppliers();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const call = useMutation({
    mutationFn: (a: { path: string; method: string; body?: unknown; ok: string }) => api(`/suppliers/${s.id}${a.path}`, { method: a.method, body: a.body }),
    onSuccess: (_, a) => {
      toast.success(a.ok);
      setConfirm(null);
      setNote(null);
      invalidate();
      if (a.method === "DELETE") onDeleted();
    },
    onError: (e) => { setConfirm(null); toast.error(errorMessage(e)); },
  });
  const address = [s.address, s.ward, s.province].filter(Boolean).join(", ");
  const sep = <span className="h-3 w-px bg-[#d9dbe0]" />;
  const setActive = (active: boolean) => call.mutate({ path: "/status", method: "PATCH", body: { active },
    ok: active ? t("suppliers.info.toastActivated") : t("suppliers.info.toastDeactivated") });
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <h3 className="flex items-baseline gap-2 text-[16px] font-bold">{s.name}
            <span className="text-[12px] font-normal text-foreground/80">{s.code}</span>
            {!s.active && <span className="rounded bg-[#fdecec] px-1.5 text-[11px] font-medium text-[#d92d20]">{tc("status.inactive")}</span>}</h3>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-foreground/80">
            <span>{renderRichText(t("suppliers.info.createdBy"), { name: <span className="text-foreground">{s.createdByName ?? "—"}</span> })}</span>{sep}
            <span>{renderRichText(t("suppliers.info.createdAt"), { date: <span className="text-foreground">{formatDate(s.createdAt)}</span> })}</span>{sep}
            <span>{renderRichText(t("suppliers.info.group"), { group: s.groupName
              ? <span className="text-foreground">{s.groupName}</span> : <span className="text-muted-foreground">{t("suppliers.info.notYet")}</span> })}</span>
          </p>
        </div>
        <span className="text-[12px] text-foreground/80">{branches.find((b) => b.id === s.branchId)?.name}</span>
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        <Field label={tc("fields.phone")} value={s.phone} /><Field label={tc("fields.email")} value={s.email} />
      </div>
      <Field label={tc("fields.address")} value={address} />
      {s.companyName || s.taxCode || s.idNumber ? (
        <div className="rounded-md border border-[#e5e7eb] bg-[#f7f8fa] px-3 py-2.5 text-[12px]">
          <div className="font-bold">{t("suppliers.info.billing")}</div>
          <p className="mt-2">{[s.companyName, s.taxCode && t("suppliers.info.taxCodeShort", { code: s.taxCode }),
            s.idNumber && t("suppliers.info.idNumberShort", { id: s.idNumber })].filter(Boolean).join(" / ")}</p>
        </div>
      ) : manage && <button type="button" className="text-[13px] font-semibold text-primary hover:underline" onClick={() => setEditing(true)}>{t("suppliers.info.addBilling")}</button>}
      {note === null ? (
        <button type="button" disabled={!manage} onClick={() => setNote(s.note ?? "")}
          className="flex items-center gap-2 text-left text-[12px] text-foreground/80 disabled:cursor-default">
          <PencilLine className="size-4 shrink-0" />{s.note ? <span className="whitespace-pre-wrap text-foreground">{s.note}</span> : <span className="text-muted-foreground">{t("suppliers.info.noNote")}</span>}
        </button>
      ) : (
        <div className="space-y-2">
          <textarea autoFocus aria-label={tc("fields.note")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("suppliers.info.notePlaceholder")}
            className="min-h-[58px] w-full rounded-md border border-[#d9dbe0] px-2.5 py-1.5 text-[13px] outline-none focus:border-primary" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className={btn} onClick={() => setNote(null)}>{tc("actions.skip")}</Button>
            <Button className={btn} disabled={call.isPending} onClick={() => call.mutate({ path: "/note", method: "PATCH", body: { note }, ok: t("suppliers.info.toastNoteSaved") })}>{tc("actions.save")}</Button>
          </div>
        </div>
      )}
      {manage && (
        <div className="flex items-center gap-2 border-t pt-3">
          <Button variant="ghost" className={`${btn} px-2`} onClick={() => setConfirm("delete")}><Trash2 className="size-4" /> {tc("actions.delete")}</Button>
          <Button className={`${btn} ml-auto`} onClick={() => setEditing(true)}><SquarePen className="size-4" /> {t("suppliers.info.edit")}</Button>
          {s.active
            ? <Button variant="outline" className={btn} onClick={() => setConfirm("deactivate")}><Lock className="size-4" /> {t("suppliers.info.deactivate")}</Button>
            : <Button variant="outline" className={btn} disabled={call.isPending} onClick={() => setActive(true)}><LockOpen className="size-4" /> {t("suppliers.info.activate")}</Button>}
        </div>
      )}
      {editing && <SupplierFormDialog supplier={s} onClose={() => setEditing(false)} />}
      {confirm && <SupplierConfirmDialog pending={call.isPending} onClose={() => setConfirm(null)}
        message={confirm === "deactivate"
          ? t("suppliers.info.confirmDeactivate")
          : t("suppliers.info.confirmDelete", { code: s.code })}
        onConfirm={() => (confirm === "deactivate" ? setActive(false)
          : call.mutate({ path: "", method: "DELETE", ok: t("suppliers.info.toastDeleted", { code: s.code }) }))} />}
    </div>
  );
}
