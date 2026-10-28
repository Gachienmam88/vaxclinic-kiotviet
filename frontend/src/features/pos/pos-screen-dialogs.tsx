"use client";

import { PosImportDialog } from "./pos-import-dialog";
import { PosOrderPickerDialog } from "./pos-order-picker-dialog";
import { PosReceiptDialog } from "./pos-receipt-dialog";
import { PosReturnPickerDialog } from "./pos-return-picker-dialog";
import { PosSettingsDialog } from "./pos-settings-dialog";
import { PosShortcutsDrawer } from "./pos-shortcuts-drawer";
import { PosSyncDialog } from "./pos-sync-dialog";
import type { ImportedSheet } from "./pos-import-workbook";
import type { PosMenuAction } from "./pos-main-menu";
import type { CatalogProduct } from "./pos-types";
import type { useOfflineQueue } from "./use-offline-queue";

export type PosDialog = PosMenuAction | "SYNC" | null;

type Props = {
  dialog: PosDialog; close: () => void; branchId: string; userName: string; online: boolean; catalog: CatalogProduct[];
  queue: ReturnType<typeof useOfflineQueue>;
  onPickOrder: (orderId: string) => void; onPickReturn: (invoiceId: string) => void; onQuickReturn: () => void;
  onImported: (sheets: ImportedSheet[]) => void;
};

/** Các hộp thoại mở từ thanh xanh / menu ☰ của màn bán hàng (mỗi lúc 1 hộp thoại). */
export function PosScreenDialogs({ dialog, close, branchId, userName, online, catalog, queue, onPickOrder, onPickReturn, onQuickReturn, onImported }: Props) {
  switch (dialog) {
    case "ORDERS": return <PosOrderPickerDialog branchId={branchId} onPick={onPickOrder} onClose={close} />;
    case "RETURN": return <PosReturnPickerDialog branchId={branchId} onPick={onPickReturn} onQuickReturn={onQuickReturn} onClose={close} />;
    case "RECEIPT": return <PosReceiptDialog branchId={branchId} userName={userName} onClose={close} />;
    case "IMPORT": return <PosImportDialog catalog={catalog} branchId={branchId} onImported={onImported} onClose={close} />;
    case "SETTINGS": return <PosSettingsDialog onClose={close} />;
    case "SHORTCUTS": return <PosShortcutsDrawer onClose={close} />;
    case "SYNC": return <PosSyncDialog queue={queue.queue} online={online} onSyncAll={queue.syncAll} onRetry={queue.retry} onRemove={queue.remove} onClose={close} />;
    default: return null;
  }
}
