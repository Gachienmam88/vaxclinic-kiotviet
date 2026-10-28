"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { storeProfileNs } from "@/messages/store-profile";
import { PauseStoreDialog } from "./pause-store-dialog";
import { PhoneChangeDialog } from "./phone-change-dialog";
import { ProfileUpdateDialog } from "./profile-update-dialog";
import { RenameStoreDialog } from "./rename-store-dialog";
import { InfoField } from "./store-profile-shell";
import { useStoreProfileMutation, type StoreProfile } from "./store-profile-queries";
import { TransferStoreDialog } from "./transfer-store-dialog";
import { UpdateChoiceDialog, type UpdateChoice } from "./update-choice-dialog";

/** Tab "Thông tin chung" (ảnh 177): Thông tin hồ sơ + Thông tin gian hàng + nút Bảo lưu / Cập nhật. */
export function StoreInfoGeneralTab({ profile }: { profile: StoreProfile }) {
  const t = useT(storeProfileNs);
  const [dialog, setDialog] = useState<"choose" | "pause" | UpdateChoice | null>(null);
  const reopen = useStoreProfileMutation<undefined>("POST", "/reopen", t("general.reopenedToast"));
  const p = profile;
  const address = [p.address, p.ward, p.province].filter(Boolean).join(", ");
  const paused = p.status.paused;
  const grid = "grid grid-cols-4 gap-x-6 gap-y-3";

  return (
    <div className="space-y-5 px-5 py-4">
      <section>
        <h3 className="mb-3 text-[13px] font-semibold">{t("general.profileSection")}</h3>
        <div className={grid}>
          <InfoField label={t("general.fields.businessType")} value={p.businessType && t(`businessTypes.${p.businessType}`)} />
          <InfoField label={t("general.fields.birthDate")} value={formatDate(p.birthDate)} />
          <InfoField label={t("general.fields.representative")} value={p.representative} />
          <InfoField label={t("general.fields.idNumber")} value={p.idNumber} />
          <InfoField label={t("general.fields.phone")} value={p.phone} />
          <InfoField label={t("general.fields.idIssueDate")} value={formatDate(p.idIssueDate)} />
          <InfoField label={t("general.fields.email")} value={p.email} />
          <InfoField label={t("general.fields.gender")} value={p.gender && t(`genders.${p.gender}`)} />
          <InfoField label={t("general.fields.idIssuePlace")} value={p.idIssuePlace} className="col-span-2" />
          <InfoField label={t("general.fields.address")} value={address} className="col-span-2" />
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-[13px] font-semibold">{t("general.storeSection")}</h3>
        <div className={grid}>
          <InfoField label={t("general.fields.accessCode")} value={p.accessCode} />
          <InfoField label={t("general.fields.storeName")} value={p.storeName} />
          <InfoField label={t("general.fields.industry")} value={p.industry} />
          <InfoField label={t("general.fields.owner")} value={p.owner ? `${p.owner.fullName} (${p.owner.username})` : null} />
          <InfoField label={t("general.fields.branchCount")} value={String(p.branchCount)} />
          <InfoField label={t("general.fields.status")} value={paused
            ? <span className="text-orange-600">{t("general.statusPaused", { date: formatDate(p.status.reopenOn) })}</span> : t("general.statusInUse")} />
        </div>
      </section>
      <div className="flex justify-end gap-2">
        {p.isOwner && (paused
          ? <button type="button" disabled={reopen.isPending} onClick={() => reopen.mutate(undefined)}
              className="h-8 rounded-md border border-border bg-background px-3 text-[13px] font-semibold hover:bg-muted">{t("general.reopen")}</button>
          : <button type="button" disabled={p.status.pauseUsed} onClick={() => setDialog("pause")}
              title={p.status.pauseUsed ? t("general.pauseUsed") : undefined}
              className="h-8 rounded-md border border-border bg-background px-3 text-[13px] font-semibold hover:bg-muted disabled:opacity-50">{t("general.pause")}</button>)}
        <button type="button" onClick={() => setDialog("choose")}
          className="h-8 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">{t("general.update")}</button>
      </div>
      {dialog === "choose" && <UpdateChoiceDialog isOwner={p.isOwner} onClose={() => setDialog(null)} onChoose={setDialog} />}
      {dialog === "profile" && <ProfileUpdateDialog profile={p} onClose={() => setDialog(null)} />}
      {dialog === "phone" && <PhoneChangeDialog profile={p} onClose={() => setDialog(null)} />}
      {dialog === "rename" && <RenameStoreDialog profile={p} onClose={() => setDialog(null)} />}
      {dialog === "transfer" && <TransferStoreDialog profile={p} onClose={() => setDialog(null)} />}
      {dialog === "pause" && <PauseStoreDialog profile={p} onClose={() => setDialog(null)} />}
    </div>
  );
}
