"use client";

import { SaleImportDialog } from "./sale-import-dialog";
import { SaleOrderPickerDialog } from "./sale-order-picker-dialog";
import { SaleReceiptDialog } from "./sale-receipt-dialog";
import { SaleReturnPickerDialog } from "./sale-return-picker-dialog";
import { SaleSettingsDialog } from "./sale-settings-dialog";
import { SaleShortcutsDrawer } from "./sale-shortcuts-drawer";
import { SaleSyncDialog } from "./sale-sync-dialog";
import type { ImportedSheet } from "./sale-import-workbook";
import type { SaleMenuAction } from "./sale-main-menu";
import type { CatalogProduct } from "./sale-types";
import type { useOfflineQueue } from "./use-offline-queue";

export type SaleDialog = SaleMenuAction | "SYNC" | null;

type Props = {
  dialog: SaleDialog; close: () => void; branchId: string; userName: string; online: boolean; catalog: CatalogProduct[];
  queue: ReturnType<typeof useOfflineQueue>;
  onPickOrder: (orderId: string) => void; onPickReturn: (invoiceId: string) => void; onQuickReturn: () => void;
  onImported: (sheets: ImportedSheet[]) => void;
};

/** Các hộp thoại mở từ thanh xanh / menu ☰ của màn bán hàng (mỗi lúc 1 hộp thoại). */
export function SaleScreenDialogs({ dialog, close, branchId, userName, online, catalog, queue, onPickOrder, onPickReturn, onQuickReturn, onImported }: Props) {
  switch (dialog) {
    case "ORDERS": return <SaleOrderPickerDialog branchId={branchId} onPick={onPickOrder} onClose={close} />;
    case "RETURN": return <SaleReturnPickerDialog branchId={branchId} onPick={onPickReturn} onQuickReturn={onQuickReturn} onClose={close} />;
    case "RECEIPT": return <SaleReceiptDialog branchId={branchId} userName={userName} onClose={close} />;
    case "IMPORT": return <SaleImportDialog catalog={catalog} branchId={branchId} onImported={onImported} onClose={close} />;
    case "SETTINGS": return <SaleSettingsDialog onClose={close} />;
    case "SHORTCUTS": return <SaleShortcutsDrawer onClose={close} />;
    case "SYNC": return <SaleSyncDialog queue={queue.queue} online={online} onSyncAll={queue.syncAll} onRetry={queue.retry} onRemove={queue.remove} onClose={close} />;
    default: return null;
  }
}
