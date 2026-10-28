# Kiểm kho / Xuất hủy / Xuất dùng nội bộ — implementation report (2026-10-28)

## Backend (product-service, package `com.vaxclinic.product.inventory`)
- Migration `V4__stock_take_and_issue_docs.sql`: `stock_takes` + `stock_take_lines`, `stock_issues` (+ `type` DAMAGE|INTERNAL) + `stock_issue_lines`, sequences KK / XH / XNB.
- Kiểm kho: DRAFT → BALANCED (Hoàn thành) / CANCELLED (draft only). Lines base unit, per lot for lot-managed (lot + HSD), `actual_qty NULL` = chưa kiểm → skipped at balance. Balance re-snapshots stock under row lock, posts `ADJUSTMENT` +/- via StockMovementService. New lot counted > 0 needs HSD. Totals stored on header (SL thực tế, Tổng thực tế, Tổng chênh lệch, lệch tăng/giảm, at cost).
- Xuất hủy / nội bộ: DRAFT/COMPLETED/CANCELLED, reason, lines unit/lot/qty/unit_cost. Complete = deduct at current cost (expired lots allowed); cancel completed = reverse. New DocTypes `DAMAGE_CANCEL`, `INTERNAL_USE`, `INTERNAL_USE_CANCEL` (DAMAGE existed). `INTERNAL_USE` added to negative-stock-allowed set (same as DAMAGE, non-lot only).
- Khóa sổ: `checkNotLocked` on balance (now), on issue complete/cancel (issuedAt). AuditLogger on every save/complete/cancel.
- Endpoints (`inventory.view` read, `inventory.manage` write): `GET/POST /api/stock-takes`, `GET/PUT /api/stock-takes/{id}`, `POST /{id}/complete`, `POST /{id}/cancel`; same for `/api/stock-issues?type=DAMAGE|INTERNAL` (type required on every call). `?complete=true` on POST/PUT = Hoàn thành. Lists return `PageResponse`, filters q/statuses/from/to/createdBy/branchId.
- S2d stock book: no change needed — new doc types valued at `cost` column; verified in E2E.
- Small touch: `ProductLotRepository.findByProductIdAndBranchIdAndLotNumber` (non-locking).

## Gateway
`/api/stock-takes/**,/api/stock-issues/**` appended to product route in gateway application.yml (not restarted).

## Frontend
Routes: `/inventory/stock-takes` (+`/new`, `?edit=id`), `/inventory/damages` (+`/new`), `/inventory/internal-use` (+`/new`). Reuse Mua hàng chrome (PurchaseListLayout/Toolbar/Pager/EmptyState/DocStatusBadge, PurchaseFilterSidebar, ProductPicker, LotSelect, LineForm, linesFromDoc). Shared purchase changes are backward-compatible: sidebar `personLabel` optional + string statuses, badge accepts BALANCED, `LotSelect`/`linesFromDoc` exported. Stock card labels added for new doc types. Menu links NOT added (lead).

## Tests
E2E `scratchpad/e2e_inventory_docs.py`: 50/50 pass (lots up/down, uncounted lot unchanged, re-snapshot at balance, ledger rows, balanced not editable/cancellable, draft edit/cancel, expired-lot xuất hủy + cancel restore, stock book in/out/closing qty+value, validation errors, khóa sổ blocks backdated complete + cancel, lock restored). `tsc --noEmit` clean; eslint clean on touched files.
Test products soft-deleted; test docs/ledger rows remain (ledger immutable).

## Unresolved questions
- Stock take time = creation time (not editable); issue time editable (like purchase returns). Ledger occurred_at is always "now" (same as purchases).
- Print templates skipped per brief.
