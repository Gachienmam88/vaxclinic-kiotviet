"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VnAddressFields } from "@/components/ui/vn-address-fields";
import { useT } from "@/lib/i18n";
import { storeProfileNs } from "@/messages/store-profile";
import { FlowFooter, useVerifyStep } from "./store-flow-parts";
import { BUSINESS_TYPES, GENDERS, useStoreProfileMutation, type StoreProfile } from "./store-profile-queries";

type Form = {
  businessType: string; email: string; gender: string; idNumber: string; birthDate: string; idIssueDate: string;
  idIssuePlace: string; representative: string; address: string; province: string; ward: string; provinceCode: string; wardCode: string;
};

const SELECT = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-[13px] outline-none focus:border-primary";

function Field({ label, required, children, wide }: { label: string; required?: boolean; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "col-span-2 grid gap-1" : "grid gap-1"}>
      <span className="text-xs text-muted-foreground">{label}{required && <span className="text-destructive"> *</span>}</span>
      {children}
    </label>
  );
}

/** "Cập nhật thông tin hồ sơ" (ảnh 180): form → bước Xác thực → lưu (ghi Lịch sử cập nhật). */
export function ProfileUpdateDialog({ profile, onClose }: { profile: StoreProfile; onClose: () => void }) {
  const t = useT(storeProfileNs);
  const [f, setF] = useState<Form>({
    businessType: profile.businessType ?? "PERSONAL", email: profile.email ?? "", gender: profile.gender ?? "",
    idNumber: profile.idNumber ?? "", birthDate: profile.birthDate ?? "", idIssueDate: profile.idIssueDate ?? "",
    idIssuePlace: profile.idIssuePlace ?? "", representative: profile.representative ?? "", address: profile.address ?? "",
    province: profile.province ?? "", ward: profile.ward ?? "", provinceCode: profile.provinceCode ?? "", wardCode: profile.wardCode ?? "",
  });
  const [step, setStep] = useState<"form" | "verify">("form");
  const verify = useVerifyStep("PROFILE", profile.twoFactorEnabled);
  const save = useStoreProfileMutation<Record<string, unknown>>("PUT", "/profile", t("profileUpdate.toast"));
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const complete = !!(f.email.trim() && f.gender && f.idNumber.trim() && f.birthDate && f.idIssueDate && f.representative.trim() && f.address.trim());

  async function submit() {
    const verifyToken = await verify.submit();
    if (!verifyToken) return;
    const nul = (s: string) => s.trim() || null;
    save.mutate({ ...f, idIssuePlace: nul(f.idIssuePlace), province: nul(f.province), ward: nul(f.ward),
      provinceCode: nul(f.provinceCode), wardCode: nul(f.wardCode), verifyToken }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-[600px]">
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">{t("profileUpdate.title")}</DialogTitle></DialogHeader>
        {step === "form" ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            <Field label={t("general.fields.businessType")} wide>
              <select className={SELECT} value={f.businessType} onChange={set("businessType")}>
                {BUSINESS_TYPES.map((v) => <option key={v} value={v}>{t(`businessTypes.${v}`)}</option>)}
              </select>
            </Field>
            <Field label={t("general.fields.email")} required><Input type="email" value={f.email} onChange={set("email")} /></Field>
            <Field label={t("general.fields.gender")} required>
              <select className={SELECT} value={f.gender} onChange={set("gender")}>
                <option value="">{t("profileUpdate.pickGender")}</option>
                {GENDERS.map((v) => <option key={v} value={v}>{t(`genders.${v}`)}</option>)}
              </select>
            </Field>
            <Field label={t("general.fields.idNumber")} required><Input value={f.idNumber} maxLength={12} onChange={set("idNumber")} /></Field>
            <Field label={t("general.fields.birthDate")} required><DatePicker value={f.birthDate} onChange={(v) => setF({ ...f, birthDate: v })} /></Field>
            <Field label={t("general.fields.idIssueDate")} required><DatePicker value={f.idIssueDate} onChange={(v) => setF({ ...f, idIssueDate: v })} /></Field>
            <Field label={t("general.fields.idIssuePlace")}><Input value={f.idIssuePlace} onChange={set("idIssuePlace")} /></Field>
            <Field label={t("general.fields.representative")} required wide><Input value={f.representative} onChange={set("representative")} /></Field>
            <VnAddressFields idPrefix="owner" addressRequired fieldClassName="grid gap-1" addressFieldClassName="col-span-2"
              labelClassName="text-xs text-muted-foreground" controlClassName="h-9 text-[13px]"
              labels={{ address: t("profileUpdate.addressRequired"), province: t("profileUpdate.province") }}
              value={{ address: f.address, provinceCode: f.provinceCode, provinceName: f.province, wardCode: f.wardCode, wardName: f.ward }}
              onChange={(v) => setF({ ...f, address: v.address, province: v.provinceName, ward: v.wardName, provinceCode: v.provinceCode, wardCode: v.wardCode })} />
            <p className="col-span-2 text-[13px]">
              {t("profileUpdate.verifyNote")}
            </p>
          </div>
        ) : verify.fields}
        <FlowFooter onCancel={step === "form" ? onClose : () => setStep("form")} cancelLabel={step === "form" ? t("flow.cancel") : t("flow.back")}
          nextLabel={step === "form" ? t("flow.next") : t("flow.confirm")}
          disabled={step === "form" ? !complete : !verify.valid || verify.pending || save.isPending}
          onNext={() => (step === "form" ? setStep("verify") : void submit())} />
      </DialogContent>
    </Dialog>
  );
}
