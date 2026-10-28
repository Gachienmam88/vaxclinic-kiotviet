"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { PauseStoreDialog } from "./pause-store-dialog";
import { PhoneChangeDialog } from "./phone-change-dialog";
import { ProfileUpdateDialog } from "./profile-update-dialog";
import { RenameStoreDialog } from "./rename-store-dialog";
import { InfoField } from "./store-profile-shell";
import { BUSINESS_TYPES, GENDERS, useStoreProfileMutation, type StoreProfile } from "./store-profile-queries";
import { TransferStoreDialog } from "./transfer-store-dialog";
import { UpdateChoiceDialog, type UpdateChoice } from "./update-choice-dialog";

const label = <T extends string>(opts: readonly (readonly [T, string])[], v: string | null) => opts.find(([k]) => k === v)?.[1] ?? null;

/** Tab "Thông tin chung" (ảnh 177): Thông tin hồ sơ + Thông tin gian hàng + nút Bảo lưu / Cập nhật. */
export function StoreInfoGeneralTab({ profile }: { profile: StoreProfile }) {
  const [dialog, setDialog] = useState<"choose" | "pause" | UpdateChoice | null>(null);
  const reopen = useStoreProfileMutation<undefined>("POST", "/reopen", "Đã mở lại gian hàng");
  const p = profile;
  const address = [p.address, p.ward, p.province].filter(Boolean).join(", ");
  const paused = p.status.paused;
  const grid = "grid grid-cols-4 gap-x-6 gap-y-3";

  return (
    <div className="space-y-5 px-5 py-4">
      <section>
        <h3 className="mb-3 text-[13px] font-semibold">Thông tin hồ sơ</h3>
        <div className={grid}>
          <InfoField label="Loại hình kinh doanh" value={label(BUSINESS_TYPES, p.businessType)} />
          <InfoField label="Ngày sinh" value={formatDate(p.birthDate)} />
          <InfoField label="Người đại diện" value={p.representative} />
          <InfoField label="CCCD/Hộ chiếu" value={p.idNumber} />
          <InfoField label="Điện thoại" value={p.phone} />
          <InfoField label="Ngày cấp" value={formatDate(p.idIssueDate)} />
          <InfoField label="Email" value={p.email} />
          <InfoField label="Giới tính" value={label(GENDERS, p.gender)} />
          <InfoField label="Nơi cấp" value={p.idIssuePlace} className="col-span-2" />
          <InfoField label="Địa chỉ" value={address} className="col-span-2" />
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-[13px] font-semibold">Thông tin gian hàng</h3>
        <div className={grid}>
          <InfoField label="Tên gian hàng" value={p.accessCode} />
          <InfoField label="Tên cửa hàng" value={p.storeName} />
          <InfoField label="Ngành hàng" value={p.industry} />
          <InfoField label="Chủ gian hàng" value={p.owner ? `${p.owner.fullName} (${p.owner.username})` : null} />
          <InfoField label="Số chi nhánh" value={String(p.branchCount)} />
          <InfoField label="Tình trạng" value={paused
            ? <span className="text-orange-600">Đang bảo lưu đến {formatDate(p.status.reopenOn)}</span> : "Đang sử dụng"} />
        </div>
      </section>
      <div className="flex justify-end gap-2">
        {p.isOwner && (paused
          ? <button type="button" disabled={reopen.isPending} onClick={() => reopen.mutate(undefined)}
              className="h-8 rounded-md border border-border bg-background px-3 text-[13px] font-semibold hover:bg-muted">Mở lại gian hàng</button>
          : <button type="button" disabled={p.status.pauseUsed} onClick={() => setDialog("pause")}
              title={p.status.pauseUsed ? "Gian hàng đã dùng lượt bảo lưu duy nhất" : undefined}
              className="h-8 rounded-md border border-border bg-background px-3 text-[13px] font-semibold hover:bg-muted disabled:opacity-50">Bảo lưu gian hàng</button>)}
        <button type="button" onClick={() => setDialog("choose")}
          className="h-8 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">Cập nhật</button>
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
