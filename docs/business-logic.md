# Logic nghiệp vụ — VaxClinic (bản sao KiotViet)

Tài liệu thống kê **toàn bộ chức năng** và quy tắc nghiệp vụ, mô tả đúng theo code hiện tại (cập nhật lần đầu 30/10/2026).

**Quy tắc bảo trì (bắt buộc):** mọi thay đổi hành vi của một chức năng phải cập nhật mục tương ứng trong file này trong **cùng commit**. Không ghi giá trị bí mật (chỉ ghi tên biến môi trường).

**Cách đọc:**
- Mỗi phần có bảng viết tắt đường dẫn riêng ở đầu phần; trích dẫn dạng `viết-tắt/đường-dẫn:dòng`.
- Mục "Giới hạn đã biết" / "Câu hỏi chưa rõ" ở cuối mỗi phần ghi những chỗ code còn thiếu hoặc chưa nhất quán.

## Mục lục
1. [Hàng hóa, kho, mua hàng](#1-hàng-hóa-kho-mua-hàng)
2. [Bán hàng, hóa đơn, trả hàng, đặt hàng](#2-bán-hàng-hóa-đơn-trả-hàng-đặt-hàng)
3. [Khách hàng, sổ quỹ, công nợ, giao hàng](#3-khách-hàng-sổ-quỹ-công-nợ-giao-hàng)
4. [Tài khoản, thiết lập, nhân viên](#4-tài-khoản-thiết-lập-nhân-viên)
5. [Tích hợp, kế toán thuế, báo cáo](#5-tích-hợp-kế-toán-thuế-báo-cáo)

## 1. Hàng hóa, kho, mua hàng

Phạm vi: `product-service` (cổng 8082, DB `product_db`) + màn hình `frontend/src/app/(admin)/{products,inventory,purchases}`. Mọi mô tả lấy từ code; chỗ nào code không thể hiện thì ghi "không thấy trong code".

Viết tắt đường dẫn trích dẫn:

| Tiền tố | Đường dẫn thật |
|---|---|
| `PS/` | `backend/product-service/src/main/java/com/vaxclinic/product/` |
| `MIG/` | `backend/product-service/src/main/resources/db/migration/` |
| `CL/` | `backend/common-lib/src/main/java/com/vaxclinic/common/` |
| `FE/` | `frontend/src/` |

### 1.0 Quy ước chung (áp dụng cho mọi mục bên dưới)

- **Xác thực**: mọi request phải có JWT (`anyRequest().authenticated()`), quyền = claim `perms`, chi nhánh = claim `branches` (`CL/security/JwtResourceServerAutoConfiguration.java:26,54,63`). Endpoint không ghi `@PreAuthorize` (VD `GET /api/categories`, `/api/tax-rates`, `/api/positions`) chỉ cần đăng nhập.
- **Bảng quyền**:

| Quyền | Dùng cho |
|---|---|
| `catalog.view` | xem hàng hóa, bảng giá, NCC, nhóm NCC, sổ công nợ NCC |
| `catalog.manage` | tạo/sửa/ngừng KD/xóa hàng hóa, nhóm hàng, vị trí, bảng giá, giá |
| `inventory.view` | xem phiếu nhập, trả hàng nhập, kiểm kho, xuất hủy/nội bộ; sổ kho S2d (cùng `report.view`) |
| `inventory.manage` | ghi phiếu nhập/trả/kiểm/xuất; thêm/sửa/xóa/import NCC, nhóm NCC; thanh toán/chiết khấu/điều chỉnh nợ NCC |
| `report.view` | báo cáo kho/NCC, sổ S2d |
| `cashbook.manage` | `GET /api/accounting/stock/product-categories` (cùng `report.view`) |
| `internal` | `/internal/**` (service-to-service; gateway không route) |
| `settings.manage` | chạy tay job cảnh báo kho |

- **Lỗi**: `BusinessException` → body `ApiError{code, message}`; `badRequest`=400, `notFound`=404, `conflict`=409 (`CL/error/BusinessException.java:17-27`). Bean validation → 400 `VALIDATION_FAILED` "Dữ liệu không hợp lệ" + `details[field,message]`; JSON sai/UUID sai → 400 `MALFORMED_REQUEST`; thiếu query param → 400 `MISSING_PARAMETER`; thiếu quyền → 403 `FORBIDDEN`; còn lại 500 `INTERNAL_ERROR` (`CL/error/GlobalExceptionHandler.java:23-60`).
- **Chi nhánh làm việc**: ghi chứng từ kho/mua hàng phải có `branchId` thuộc claim `branches`, nếu không → 400 `BRANCH_NOT_ALLOWED` "Bạn không làm việc tại chi nhánh này" (`PS/purchase/PurchaseLineSupport.java:34-38`).
- **Khóa sổ** (Thiết lập → Khóa sổ, lưu ở identity-service): chứng từ có ngày (giờ VN) ≤ ngày khóa của chi nhánh → 400 `BOOK_LOCKED` "Sổ đã khóa đến ngày dd/MM/yyyy: không được tạo, sửa hoặc hủy giao dịch từ ngày này trở về trước" (`CL/settings/ShopSettings.java:58-65`). Thiết lập đọc từ identity `GET /internal/settings`, cache 30 s; `get()` gọi HTTP đồng bộ khi hết hạn, `cached()` không bao giờ chặn (làm mới nền mỗi 10 s); identity lỗi → dùng bản cũ, chưa có → mặc định (`CL/settings/ShopSettingsClient.java:15-64`). Mặc định `allowNegativeStock=false` (`CL/settings/ShopSettings.java:23-26`).
- **Lịch sử thao tác**: ghi sau commit qua `AuditLogger` → identity `POST /internal/audit-logs`, gửi nền theo lô ≤200, hàng đợi 10.000 (đầy thì bỏ bản cũ nhất); tắt service khi chưa gửi hết thì mất (`CL/audit/HttpAuditLogger.java:13-21,47-53`).
- **Tìm kiếm không dấu**: `immutable_unaccent(lower(col)) LIKE immutable_unaccent(lower(:q))` + GIN trigram trên `products.name`, `products.short_name`, `suppliers.name` (`MIG/V8__accent_insensitive_search.sql:5-14`, `CL/search/AccentInsensitiveSql.java:15-17`).
- **Phân trang API**: `page` ≥0, `size` kẹp [1,100], mặc định 15 (VD `PS/product/ProductController.java:61`, `PS/purchase/PurchaseController.java:48`). FE cho chọn 15/30/50/100 dòng (`FE/features/purchases/purchase-list-chrome.tsx:78`).
- **Link sâu `?code=`**: lọc theo mã, mọi trạng thái, toàn thời gian, mở sẵn chi tiết (`FE/features/purchases/purchase-queries.ts:27-29`, `FE/features/inventory/use-inventory-list-state.ts:12-13`, `FE/app/(admin)/products/page.tsx:20-25`).
- **Ô tìm trên danh sách**: debounce 300 ms (VD `FE/app/(admin)/products/page.tsx:31-34`).
- **Xuất CSV (trình duyệt)**: 3 hàm `downloadCsv` khác nhau, mức chống công thức Excel khác nhau:

| Hàm | Dùng ở | Chặn `= + - @` đầu ô |
|---|---|---|
| `FE/features/accounting/tax-calc.ts:97-102` | Thiết lập giá, kiểm kho, xuất hủy/nội bộ, nhập hàng, trả hàng nhập | Có, chỉ với giá trị kiểu chuỗi (thêm `'`) |
| `FE/features/sales/customer-csv-export.tsx:13` | danh sách NCC, sổ nợ NCC, lịch sử nhập/trả NCC, file mẫu import NCC | **Không** (chỉ bọc ngoặc kép) |
| `FE/features/sales/invoice-list-pager.tsx:41` | hóa đơn đầu vào | **Không** |

  Tất cả UTF-8 có BOM.

---

### 1.1 Hàng hóa (sản phẩm + đơn vị tính)

**1. Mục đích / màn hình / API**
- Danh mục hàng (vắc xin/vật tư); mỗi hàng có 1 đơn vị cơ bản + n đơn vị quy đổi, mỗi đơn vị 1 mã hàng riêng. Route `/products` (`FE/app/(admin)/products/page.tsx`).

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/products` | catalog.view |
| GET | `/api/products/sale-catalog?branchId=&withPriceBooks=` | catalog.view |
| GET | `/api/products/{id}` | catalog.view |
| GET | `/api/products/{id}/ledger?branchId=&page=&size=` | catalog.view |
| GET | `/api/products/{id}/lots` | catalog.view |
| POST | `/api/products` | catalog.manage |
| PUT | `/api/products/{id}` | catalog.manage |
| PATCH | `/api/products/{id}/active` body `{"active":bool}` | catalog.manage |
| DELETE | `/api/products/{id}` | catalog.manage |
| POST | `/internal/products/tax-info` (≤500 id) | internal |

Nguồn: `PS/product/ProductController.java:37-115`, `PS/internal/InternalProductTaxController.java:20-35`.

**2. Dữ liệu**
- `products`: `name`(250), `short_name`(100), `einvoice_name`(250), `category_id` NOT NULL, `tax_rate_id`, `tax_reduction`, `lot_managed`, `cost` NUMERIC(18,4) = giá vốn bình quân / đơn vị cơ bản, `min_stock` mặc định 0, `max_stock` mặc định 999.999.999, `position_id`, `weight`, `weight_unit` mặc định `g`, `loyalty_points` mặc định TRUE, `active` mặc định TRUE, `deleted` (`MIG/V1__init_product_schema.sql:29-51`).
- `product_units`: `code` UNIQUE(50), `barcode`(100, có index, không unique), `unit_name`(50), `conversion_rate` NUMERIC(18,4) = số đơn vị cơ bản / 1 đơn vị, `price` NUMERIC(18,2) = **giá chung**, `is_base` (unique partial index: 1 đơn vị cơ bản/hàng), `direct_sale` mặc định TRUE, `sort_order` (`MIG/V1__init_product_schema.sql:56-70`).
- Mã hàng: `SP%06d` từ sequence `product_code_seq` (an toàn đồng thời) khi để trống (`PS/product/ProductUnitSync.java:79-82`, `PS/product/ProductRepository.java:23-25`). Mã nhập tay được `trim().toUpperCase()` (`PS/product/ProductUnitSync.java:83`).
- Tồn, giá vốn, định mức tồn đều theo đơn vị cơ bản (`PS/product/Product.java:20-23`).

**3. Quy tắc**
- Validation request (`PS/product/ProductDtos.java:23-60`): `name` NotBlank "Nhập tên hàng"; `categoryId` NotNull "Chọn nhóm hàng"; `cost`, `minStock`, `maxStock` NotNull ≥0; `units` NotEmpty; mỗi unit: `unitName` NotBlank "Nhập tên đơn vị", `conversionRate` ≥0.0001 "Giá trị quy đổi phải > 0", `price` ≥0.
- Kiểm tra nghiệp vụ (`PS/product/ProductCommandService.java:93-104`):
  - nhóm hàng không tồn tại → 400 `CATEGORY_NOT_FOUND` "Nhóm hàng không tồn tại";
  - thuế suất không tồn tại → 400 `TAX_RATE_NOT_FOUND`;
  - vị trí không tồn tại → 400 `POSITION_NOT_FOUND`;
  - `minStock > maxStock` → 400 `STOCK_LIMIT_INVALID` "Định mức tồn thấp nhất phải ≤ cao nhất".
- Chuẩn hóa: `shortName`/`einvoiceName` trống → NULL; `weightUnit` chỉ nhận `kg`, khác → `g` (`PS/product/ProductCommandService.java:105-118`).
- **Giá vốn nhập tay chỉ ghi khi hàng chưa có dòng thẻ kho nào**; sau đó do nhập hàng tính bình quân (`PS/product/ProductCommandService.java:119-122`).
- **Đơn vị tính** (`PS/product/ProductUnitSync.java:29-77`):
  - phần tử đầu = đơn vị cơ bản, phải có quy đổi = 1, nếu không → 400 `BASE_UNIT_RATE`;
  - tên đơn vị trùng (không phân biệt hoa thường) → 400 `UNIT_DUPLICATE` "Trùng tên đơn vị: …";
  - mã trùng trong cùng request → 400 `CODE_DUPLICATE`;
  - đổi/xóa đơn vị cơ bản đã có → 400 `BASE_UNIT_LOCKED` "Không được đổi hoặc xóa đơn vị cơ bản";
  - `id` không thuộc hàng → 400 `UNIT_NOT_FOUND`;
  - mã đã tồn tại ở hàng khác (so `lower(code)`, **kể cả hàng đã xóa mềm**) → 409 `PRODUCT_CODE_EXISTS` "Mã hàng X đã tồn tại" (`PS/product/ProductRepository.java:17-21`);
  - đơn vị không còn trong request bị xóa (orphanRemoval); `sort_order` = vị trí trong list.
- **Đổi chế độ lô** khi hàng đã có thẻ kho → 400 `LOT_MODE_LOCKED` (`PS/product/ProductCommandService.java:61-64`).
- **Tồn đầu kỳ** (chỉ khi tạo, cùng transaction) (`PS/product/ProductCommandService.java:125-142`):
  - `openingStock.branchId` phải thuộc chi nhánh của user, nếu không → `BRANCH_NOT_ALLOWED`;
  - hàng theo lô: mỗi lô 1 movement `OPENING` (`lotNumber` NotBlank ≤50, `expiryDate` NotNull, `quantity` ≥0); hàng thường: 1 movement `OPENING`;
  - đơn giá movement = `req.cost` → khởi tạo giá vốn bình quân; `doc_code` = mã đơn vị cơ bản, `doc_id` = id hàng;
  - không kiểm tra khóa sổ (không thấy `checkNotLocked`).
- **Ngừng kinh doanh**: chỉ đổi `active` (`PS/product/ProductCommandService.java:72-76`).
- **Xóa** = xóa mềm (`deleted=true`, `active=false`), giữ dữ liệu cho thẻ kho/hóa đơn cũ (`PS/product/ProductCommandService.java:78-85`). Hàng đã xóa → 404 `PRODUCT_NOT_FOUND` ở mọi API đọc/ghi.
- Lịch sử thao tác: chức năng "Hàng hóa", hành động Tạo / Sửa / Kinh doanh / Ngừng kinh doanh / Xóa, mã = mã đơn vị đầu tiên (`PS/product/ProductManageService.java:67-99`).
- **Danh mục bán hàng** (`sale-catalog`, máy POS lưu cục bộ để bán offline): hàng `active` và chưa xóa, chỉ đơn vị `direct_sale`, tồn tại 1 chi nhánh, `taxCode`, `taxReduction`; `withPriceBooks=true` thêm bảng giá (xem 1.6) (`PS/product/SaleCatalogRepository.java:39-49`, `PS/product/ProductManageService.java:50-53`).
- **tax-info nội bộ** (sales-service tự tra khi tính "Giảm thuế"): mã thuế, cờ giảm thuế, chuỗi nhóm hàng từ nhóm lá lên gốc (tối đa 20 cấp); bỏ id trùng; id không tồn tại thì không có trong kết quả (`PS/internal/ProductTaxInfoRepository.java:29-46`).

**4. Danh sách `/products`**
- Bộ lọc (`PS/product/ProductListRepository.java:57-120`, `FE/features/products/product-filter-sidebar.tsx:96-136`):
  - `q`: tên / tên viết tắt (không dấu) hoặc mã đơn vị / mã vạch `ILIKE` bất kỳ đơn vị;
  - nhóm hàng nhiều chọn (chọn nhóm cha lấy cả nhóm con, đệ quy);
  - thuế suất nhiều chọn;
  - giảm thuế Tất cả/Có/Không;
  - tồn kho `ALL|BELOW_MIN|ABOVE_MAX|IN_STOCK|OUT_OF_STOCK` (so tổng tồn mọi chi nhánh hoặc 1 chi nhánh nếu có `branchId`; FE không gửi `branchId`);
  - thời gian tạo `[from 00:00, to+1 ngày 00:00)` giờ máy;
  - **dự kiến hết hàng** theo khoảng ngày;
  - trạng thái, **mặc định "Đang kinh doanh"** (`FE/features/products/product-queries.ts:23-26`).
- **Dự kiến hết hàng** `expectedOutDays` = `floor(max(tồn,0) × min(30, max(1, số ngày từ lúc tạo)) / bán ròng 30 ngày)`; bán ròng = −Σ`quantity` thẻ kho loại `SALE`,`RETURN` trong 30 ngày; NULL nếu chưa bán. Lọc theo ngày = hôm nay (VN) + days; hàng NULL bị loại (`PS/product/ProductListRepository.java:37-49,109-120`).
  - Lưu ý: code lọc `doc_type in ('SALE','RETURN')`, nhưng enum không có `RETURN` mà là `SALE_RETURN`/`SALE_CANCEL`, nên hiện chỉ tính `SALE` (`PS/stock/StockLedgerEntry.java:24-27`).
- Cột (`FE/features/products/product-list-table.tsx:35-45`): Mã hàng (đơn vị cơ bản), Tên (+ĐVT, các ĐVT khác, "· Lô"), Tên viết tắt, Giá bán (giá chung đv cơ bản), VAT bán ra, Giảm thuế, Giá vốn, Tồn kho, Khách đặt, Thời gian tạo, Dự kiến hết hàng. Dòng đầu = tổng tồn của toàn bộ kết quả lọc. Sắp xếp `created_at desc`. Trang 15 dòng cố định (`FE/app/(admin)/products/page.tsx:18`).
- Chi tiết (panel dưới dòng):
  - Thẻ kho: 10 dòng/trang (`FE/features/products/product-queries.ts:66`); API kẹp ≤100, mới nhất trước (`PS/product/ProductDetailQuery.java:66-74`).
  - Tồn kho theo chi nhánh + lô: FE tô đỏ lô hết hạn, cam nếu <90 ngày (`FE/features/products/product-detail-tabs.tsx:121-127`).
  - "Hàng cùng loại": giá vốn = cost×quy đổi, tồn = tồn/quy đổi (`FE/features/products/product-detail-tabs.tsx:177-179`).
- Form FE: bắt buộc tên, nhóm, tên ĐVT cơ bản (`FE/features/products/product-form-dialog.tsx:62-65`). "Lưu & Tạo thêm" giữ nhóm + thuế (`FE/features/products/product-form-dialog.tsx:67-68`). Chi nhánh tồn đầu mặc định = chi nhánh đầu tiên của user; ô chọn chỉ hiện khi user có >1 chi nhánh (`FE/features/products/product-form-sections.tsx:95-100`).
- Không có xuất/nhập file hàng hóa trong code.

**5. Giới hạn đã thấy**
- Không có code ghi `stock_balances.reserved` ("Khách đặt") trong product-service, nên cột này luôn là giá trị trong DB (mặc định 0) (`PS/stock/StockBalance.java:44-46`).
- Danh sách không giới hạn theo chi nhánh của user.
- Mã của hàng đã xóa mềm vẫn chiếm chỗ, không dùng lại được.

---

### 1.2 Nhóm hàng

- **API**: `GET /api/categories` (đăng nhập); `POST` / `PUT /{id}` / `DELETE /{id}` cần catalog.manage (`PS/catalog/CatalogLookupController.java:33-56`). FE tạo nhanh qua `prompt()` ở sidebar và form hàng (`FE/features/products/product-queries.ts:99-105`).
- **Dữ liệu**: `categories(id, name(150), parent_id, created_at)`, cây nhiều cấp; seed "Vắc xin" (`MIG/V1__init_product_schema.sql:3-8,114`). Response có `productCount` = số hàng chưa xóa nằm trực tiếp trong nhóm (`PS/catalog/CatalogLookupService.java:26-28,110-116`). Sắp xếp theo tên.
- **Quy tắc** (`PS/catalog/CatalogLookupService.java:59-124`):
  - `name` NotBlank ≤150, được trim;
  - nhóm cha không tồn tại → 400 `PARENT_NOT_FOUND`;
  - sửa đặt cha = chính nó → 400 `CATEGORY_SELF_PARENT`;
  - xóa khi còn nhóm con hoặc hàng chưa xóa → 409 `CATEGORY_IN_USE`;
  - sửa nhóm không tồn tại → 404 `CATEGORY_NOT_FOUND`.
- Không kiểm tra trùng tên. Không chặn vòng A→B→A (chỉ chặn tự làm cha). Truy vấn đệ quy `WITH RECURSIVE … UNION ALL` ở danh sách hàng / bảng giá không có điều kiện dừng vòng (`PS/product/ProductListRepository.java:77-78`).
- Nhóm hàng của mọi mặt hàng (kể cả đã xóa) cho kế toán: `GET /api/accounting/stock/product-categories` (`PS/stock/StockBookController.java:29-33`).

---

### 1.3 Đơn vị tính / quy đổi

- Quy tắc lưu ở 1.1 (`ProductUnitSync`).
- Chứng từ (nhập, trả, xuất hủy) **chụp `conversion_rate` tại thời điểm lập phiếu**; SL kho = `quantity × conversion_rate` (`PS/purchase/PurchaseReceiptService.java:173,198`).
- Đơn vị bị xóa sau khi lập phiếu:
  - phiếu nhập/trả hiển thị mã "—", tên "(đơn vị đã xóa)" (`PS/purchase/PurchaseDetailMapper.java:81-90`);
  - xuất hủy hiển thị theo đơn vị cơ bản (`PS/inventory/InventoryDocMapper.java:54-55`);
  - bảng giá xóa giá của đơn vị đó (FK `ON DELETE CASCADE`, `MIG/V5__price_books.sql:33`).
- Đổi đơn vị trên dòng phiếu ở FE quy đổi lại đơn giá và giảm giá theo tỷ lệ, làm tròn đồng (`FE/features/purchases/purchase-line-form.ts:40-44`). Đơn giá đề xuất khi thêm dòng = `round(giá vốn)` theo đơn vị cơ bản (`FE/features/purchases/purchase-line-form.ts:30`).
- Kiểm kho luôn theo đơn vị cơ bản (`PS/inventory/InventoryDocDtos.java:14`).

---

### 1.4 Lô – hạn sử dụng (HSD)

- **Dữ liệu**: `product_lots(product_id, branch_id, lot_number(50), expiry_date NOT NULL, quantity)`, UNIQUE `(product_id, branch_id, lot_number)`; tổng các lô = `stock_balances.quantity` (`MIG/V1__init_product_schema.sql:82-92`). Chỉ hàng `lot_managed`.
- **Quy tắc ghi lô** (`PS/stock/StockMovementService.java:102-129`):
  - thiếu số lô → 400 `LOT_REQUIRED` "… quản lý theo lô: cần nhập số lô"; số lô được trim;
  - lô chưa có mà thiếu HSD → 400 `EXPIRY_REQUIRED`;
  - HSD gửi lên khác HSD lô **đang còn tồn** → 400 `LOT_EXPIRY_MISMATCH` "Lô X đã có hạn sử dụng …" (lô đã về 0 thì không báo, nhưng HSD cũ vẫn giữ, không ghi đè);
  - lô âm → 400 `INSUFFICIENT_LOT_STOCK` "Lô X không đủ tồn" (lô không bao giờ được âm, kể cả khi bật bán âm kho);
  - khóa dòng lô `PESSIMISTIC_WRITE` (`PS/stock/ProductLotRepository.java:14-16`).
- **FEFO**: lô còn tồn sắp theo `expiry_date ASC, lot_number ASC` (`PS/stock/ProductLotRepository.java:20-22`).
  - Bán (sales-service gọi `SALE`): chỉ lấy lô **chưa hết hạn** (`expiry ≥ hôm nay`, `LocalDate.now()` theo múi giờ JVM) tại chi nhánh, lấy dần tới đủ; thiếu → 400 `INSUFFICIENT_STOCK` "…: không đủ tồn ở các lô còn hạn sử dụng (thiếu n)". Trước khi đọc lô, khóa dòng `stock_balances` để 2 lần bán đồng thời không phân bổ trùng (`PS/internal/InternalStockService.java:116-133,230-234`).
  - Dòng bán có chỉ định lô (import hóa đơn): lô phải tồn tại (`LOT_NOT_FOUND`), chưa hết hạn (`LOT_EXPIRED`), đủ tồn (`INSUFFICIENT_LOT_STOCK` "…(còn n)"); không áp FEFO (`PS/internal/InternalStockService.java:144-157`).
  - Xuất hủy, xuất nội bộ, trả hàng nhập: người dùng chọn lô; ô chọn FE liệt kê **mọi lô còn tồn tại chi nhánh, kể cả lô hết hạn**, theo thứ tự FEFO (`FE/features/purchases/purchase-line-table.tsx:24-38`). Backend không chặn lô hết hạn cho các phiếu này (`PS/inventory/StockIssueService.java:22-25`).
- **Khách trả hàng** (`SALE_RETURN`): lô đã có → dùng HSD của lô; HSD gửi lên lệch → 400 `LOT_EXPIRY_MISMATCH` (thông báo dd/MM/yyyy); lô chưa có → dùng HSD gửi lên (trả nhanh tạo lô mới), không có → `EXPIRY_REQUIRED`; lô đã hết hạn vẫn nhận (`PS/internal/SaleReturnLotExpiryResolver.java:12-41`).
- API `GET /api/products/{id}/lots`: lô còn tồn ở mọi chi nhánh, FEFO (`PS/product/ProductDetailQuery.java:76-82`).
- **Cảnh báo HSD** (Hộp thư đến, xem 1.15): `LOT_EXPIRING` (≤ N ngày, N từ thiết lập thông báo, mặc định 30) và `LOT_EXPIRED` (đã hết hạn mà còn tồn).

---

### 1.5 Tồn kho / thẻ kho (stock ledger) / sổ kho S2d-HKD

- **Dữ liệu**:
  - `stock_balances(product_id, branch_id)` PK, `quantity`, `reserved` (`MIG/V1__init_product_schema.sql:74-80`);
  - `stock_ledger`: bất biến (không sửa/xóa, sai thì ghi bút toán khác), gồm `doc_type`, `doc_id`, `doc_code`, `occurred_at` mặc định `now()`, `quantity` (+nhập/−xuất, đơn vị cơ bản), `unit_price` (giá giao dịch), `cost` (giá vốn **sau** giao dịch), `balance_after` (tồn chi nhánh sau giao dịch), `partner_name`, `created_by` (`MIG/V1__init_product_schema.sql:95-111`, `PS/stock/StockLedgerEntry.java:15`).
- **Điểm duy nhất thay đổi tồn**: `StockMovementService.apply`, bắt buộc chạy trong transaction có sẵn (`Propagation.MANDATORY`). Thứ tự: khóa `stock_balances` FOR UPDATE (chưa có thì tạo) → kiểm âm → cập nhật lô → tính lại giá vốn → ghi thẻ kho. Bỏ qua movement có SL = 0 (`PS/stock/StockMovementService.java:16-100`).
- **doc_type và dấu** (`PS/stock/StockLedgerEntry.java:24-34`):

| doc_type | Dấu | Nguồn | Đổi giá vốn |
|---|---|---|---|
| OPENING | + | tồn đầu khi tạo hàng | có |
| PURCHASE | + | hoàn thành phiếu nhập | có |
| PURCHASE_CANCEL | − | hủy phiếu nhập đã hoàn thành | có |
| PURCHASE_RETURN | − | hoàn thành trả hàng nhập | có |
| PURCHASE_RETURN_CANCEL | + | hủy trả hàng nhập đã hoàn thành | có |
| SALE | − | sales-service: SALE / SALE_REPLACE / SALE_MERGE | không |
| SALE_CANCEL | + | hủy / sửa / gộp hóa đơn (hoàn lô cũ) | không |
| SALE_RETURN | + | khách trả hàng | không |
| SALE_RETURN_CANCEL_OUT | − | hủy phiếu khách trả | không |
| ADJUSTMENT | ± | cân bằng kiểm kho | không |
| DAMAGE / DAMAGE_CANCEL | − / + | xuất hủy / hủy phiếu | không |
| INTERNAL_USE / INTERNAL_USE_CANCEL | − / + | xuất nội bộ / hủy phiếu | không |
| TRANSFER_OUT / TRANSFER_IN | − / + | khai báo enum, **không có code nào ghi** | không |

- **Chặn âm kho** (`PS/stock/StockMovementService.java:43-67`): chỉ chặn chiều xuất, khi tồn sau < 0 → 400 `INSUFFICIENT_STOCK` "Không đủ tồn kho cho …". Ngoại lệ khi bật "Cho phép giao dịch khi hết tồn kho" (`sales.allowNegativeStock`, đọc `cached()`): chỉ hàng **không theo lô** và chỉ loại `SALE`, `PURCHASE_RETURN`, `SALE_RETURN_CANCEL_OUT`, `TRANSFER_OUT`, `DAMAGE`, `INTERNAL_USE`. Hủy phiếu nhập không bao giờ được làm âm. Chiều nhập luôn được, kể cả tồn đang âm.
- **Giá vốn bình quân di động** (`PS/stock/StockMovementService.java:73-82`):
  - chỉ với loại "đổi giá vốn" ở bảng trên, khi `unitPrice ≠ null` và tồn sau > 0;
  - `cost_mới = (cost_cũ × max(tồn_trước,0) + unitPrice × qty) / tồn_sau`, làm tròn 4 số lẻ HALF_UP; nếu tử số < 0 thì giữ giá cũ; tồn về 0 thì giữ giá cuối;
  - `tồn_trước`/`tồn_sau` là tồn **của chi nhánh đang ghi**, còn `products.cost` là **một giá chung cho mọi chi nhánh**.
- Thẻ kho: `unit_price` = đơn giá movement, nếu NULL thì = giá vốn hiện tại; `cost` = giá vốn sau giao dịch (`PS/stock/StockMovementService.java:94-95`).
- **Khóa đồng thời**: `stock_balances` và `product_lots` dùng `PESSIMISTIC_WRITE` (`PS/stock/StockBalanceRepository.java:12-15`). Entity `Product` không có `@Version` (grep không thấy `@Version` trong service), nên `products.cost` có thể bị ghi đè khi 2 chi nhánh nhập cùng 1 hàng đồng thời (chỉ khóa theo hàng × chi nhánh).
- **Thời điểm thẻ kho** = lúc ghi movement (`occurred_at` mặc định `now()`; `Movement` không mang thời gian chứng từ) (`PS/stock/StockLedgerEntry.java:58-59`). Vì vậy ngày nhập (`received_at`) hay ngày xuất hủy (`issued_at`) chọn lùi ngày **không** làm lùi thẻ kho / sổ S2d.
- **Sổ S2d-HKD** `GET /api/accounting/stock/summary?from=&to=&branchIds=` (report.view hoặc inventory.view):
  - ngày [from, to] giờ VN → `[from 00:00, to+1 00:00)` (`PS/stock/StockBookService.java:28-30`);
  - tồn đầu / nhập (qty>0) / xuất (qty<0) / tồn cuối theo hàng; giá trị = `round(qty × unit_price)` với OPENING / PURCHASE* (giá giao dịch), các loại khác `round(qty × cost)`; `branchIds` rỗng = mọi chi nhánh; bỏ hàng không phát sinh (`PS/stock/StockBookRepository.java:37-71`);
  - endpoint này **không** giới hạn theo claim `branches` (khác các báo cáo ở 1.15).

---

### 1.6 Bảng giá & công thức giá (Thiết lập giá)

**1. Mục đích / màn hình / API**
- Route `/products/price-books`: ma trận dòng = đơn vị tính, cột = "Bảng giá chung" (giá chung) + các bảng giá đang chọn (`FE/app/(admin)/products/price-books/page.tsx:21-53`).

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/price-books` | catalog.view |
| GET | `/api/price-books/items?bookIds=&q=&categoryIds=&stock=&branchId=&inBookOnly=&priceOp=&compareWith=&compareBookId=&code=&name=&page=&size=` | catalog.view |
| GET | `/api/price-books/{id}` | catalog.view |
| GET | `/api/price-books/{id}/items` (`inBookOnly` mặc định true) | catalog.view |
| POST | `/api/price-books` | catalog.manage |
| PUT | `/api/price-books/{id}` | catalog.manage |
| DELETE | `/api/price-books/{id}` | catalog.manage |
| PUT | `/api/price-books/{id}/items` | catalog.manage |
| POST | `/api/price-books/{id}/items/apply-formula` | catalog.manage |
| POST | `/api/price-books/{id}/items/import` | catalog.manage |
| PUT | `/api/price-books/base-prices` | catalog.manage |
| POST | `/api/price-books/base-prices/apply-formula` | catalog.manage |

Nguồn: `PS/pricebook/PriceBookController.java:42-146`.

**2. Dữ liệu** (`MIG/V5__price_books.sql:5-38`, `MIG/V9__price_book_formula_base.sql:4-7`)
- `price_books`:
  - `name`(150), UNIQUE `lower(name)`;
  - `valid_from` < `valid_to` (CHECK); `active` (Áp dụng / Chưa áp dụng);
  - `branch_ids`, `customer_group_ids`, `seller_ids`: mảng UUID, NULL = tất cả;
  - `missing_policy` `ALLOW|BLOCK|WARN`, mặc định ALLOW;
  - `auto_update`, `auto_op` `PLUS|MINUS`, `auto_value` ≥0, `auto_percent`;
  - `auto_base` `BASE_PRICE|COST|LAST_PURCHASE|BOOK` (NULL = không có công thức), `auto_base_book_id` (FK `ON DELETE SET NULL`);
  - `created_by`, `created_by_name`.
- `price_book_items(price_book_id, unit_id)` PK, `price` ≥0 NUMERIC(18,2); xóa bảng giá hoặc đơn vị → cascade. Không có dòng = hàng không có trong bảng giá.
- Không có mã chứng từ / sequence.

**3. Quy tắc**
- **Validation request** (`PS/pricebook/PriceBookDtos.java:42-62`): `name` NotBlank "Nhập tên bảng giá", ≤150 "Tên bảng giá tối đa 150 ký tự"; `validFrom`/`validTo` NotNull; `missingPolicy` NotNull; `autoValue` ≥0 "Giá trị công thức không được âm".
- **Kiểm tra nghiệp vụ** (`PS/pricebook/PriceBookService.java:71-101`):
  - `autoBase=CURRENT` → 400 `FORMULA_BASE_INVALID`;
  - `autoBase=BOOK` mà thiếu id hoặc trỏ chính nó → 400 `FORMULA_BOOK_REQUIRED` "Chọn bảng giá khác làm gốc công thức"; bảng giá gốc không tồn tại → 404 `PRICE_BOOK_NOT_FOUND`;
  - `validFrom ≥ validTo` → 400 `PRICE_BOOK_VALIDITY`;
  - phạm vi là list rỗng → 400 `PRICE_BOOK_SCOPE` "Chọn ít nhất 1 {chi nhánh|nhóm khách hàng|người tạo giao dịch} hoặc chọn Tất cả";
  - trùng tên → 409 `PRICE_BOOK_NAME_DUPLICATE`.
- `auto_update` lưu = (gốc hiệu lực == `BASE_PRICE`); gốc hiệu lực = `autoBase`, hoặc `BASE_PRICE` nếu chỉ bật `autoUpdate` (dữ liệu cũ) (`PS/pricebook/PriceBookDtos.java:58-61`, `PS/pricebook/PriceBookRepository.java:83-89`). Mảng phạm vi được bỏ id trùng (`PS/pricebook/PriceBookRepository.java:93-95`).
- **Công thức lưu trong bảng giá** (`PS/pricebook/PriceBookService.java:59-69`):
  - **tạo mới** → điền giá cho **mọi đơn vị của hàng đang kinh doanh** có giá gốc;
  - **sửa** → chỉ tính lại các đơn vị **đã có** trong bảng;
  - dòng không có giá gốc (VD chưa từng nhập → không có giá nhập cuối) bị bỏ qua (`PS/pricebook/PriceBookItemRepository.java:55-57`).
- **Hàm công thức** (DB, dùng chung cho trigger và áp công thức): `greatest(0, round(pct ? base × (1 ± val/100) : base ± val, 0))`, tức làm tròn đồng và không âm (`MIG/V5__price_books.sql:40-46`). FE preview cùng công thức (`FE/features/products/price-book-formula-inputs.tsx:46-49`).
- **Gốc giá** (`PS/pricebook/PriceBookRowRepository.java:29-35`, `PS/pricebook/PriceBookItemRepository.java:74-84`):
  - `BASE_PRICE` = `product_units.price`;
  - `COST` = `products.cost × conversion_rate`;
  - `LAST_PURCHASE` = `unit_price − discount` của dòng nhập **cùng đơn vị** ở phiếu `COMPLETED` có `received_at` mới nhất (giá chưa VAT, chưa phân bổ giảm giá phiếu);
  - `BOOK` = giá ở bảng khác;
  - `CURRENT` = giá hiện tại của chính cột (chỉ cho "Đặt giá theo công thức").
- **Trigger theo giá chung**: khi `product_units.price` đổi (mọi đường ghi), mọi bảng giá có `auto_update` cập nhật giá **của các dòng đã có** = công thức(giá chung mới) (`MIG/V5__price_books.sql:48-62`). Gốc COST / LAST_PURCHASE / BOOK không tự cập nhật.
- **Sửa giá từng ô** `PUT /{id}/items` (`PS/pricebook/PriceBookItemService.java:32-48`, `PS/pricebook/PriceBookDtos.java:76-81`): 1–2000 dòng; `price=null` → bỏ hàng khỏi bảng; giá ≥0 "Giá không được âm"; có `unitId` không tồn tại → 400 `UNIT_NOT_FOUND` "Có hàng hóa không tồn tại"; ghi kiểu upsert `ON CONFLICT`.
- **Sửa giá chung** `PUT /base-prices`: 1–2000 dòng, `price` NotNull "Nhập giá" ≥0 (`PS/pricebook/PriceBookDtos.java:93-98`). FE chặn để trống ô giá chung (`FE/features/products/price-book-price-cell.tsx:50`).
- **Đặt giá theo công thức** (`PS/pricebook/PriceBookDtos.java:104-121`, `PS/pricebook/PriceBookItemRepository.java:50-67`):
  - áp cho các dòng thuộc bộ lọc hiện tại (giống sidebar) hoặc chỉ `unitIds` (≤2000; FE gửi `[unitId]` khi không tích "áp dụng tất cả");
  - `onlyExisting` = chỉ hàng đã có trong bảng (FE bật khi tích tất cả + lọc "chỉ hàng trong bảng giá") (`FE/features/products/price-book-formula-popover.tsx:66-73`);
  - `value` NotNull ≥0; gốc `BOOK` thiếu id → `FORMULA_BOOK_REQUIRED` "Chọn bảng giá làm gốc công thức";
  - trên cột giá chung: ghi `product_units.price` (kéo theo trigger).
- **Nhập file giá** (`PS/pricebook/PriceBookItemService.java:89-126`, `PS/pricebook/PriceBookDtos.java:126-137`):
  - body `rows[{line, code, price}]`, 1–5000 dòng; mã khớp `lower(code)` của hàng **chưa xóa** (`PS/pricebook/PriceBookItemRepository.java:101-110`);
  - lỗi theo dòng: "Thiếu mã hàng", "Không tìm thấy mã hàng", "Giá không hợp lệ: …", "Giá không được âm";
  - giá chấp nhận "1,250,000" / "1250000" / "1250000.5" (bỏ dấu phẩy và khoảng trắng);
  - mã trùng trong file → dòng sau ghi đè; dòng hợp lệ vẫn ghi dù có dòng lỗi; trả `{updated, errors[]}`.
- **FE nhập file**: chỉ `.csv`; tự nhận dấu phân cách `,` / `;`; cột mã = "Mã hàng"; cột giá = cột trùng tên bảng giá, nếu không có thì "Giá" / "Giá bán", nếu không có thì cột kế mã; không có tiêu đề thì cột 1 = mã, cột 2 = giá (`FE/features/products/price-book-csv.ts:41-61`). Chỉ nhập được khi đang chọn đúng 1 bảng giá (`FE/app/(admin)/products/price-books/page.tsx:56-59`).
- **Xóa bảng giá**: xóa cứng + toàn bộ giá trong bảng (`PS/pricebook/PriceBookRepository.java:69-71`); bảng khác dùng bảng này làm gốc → `auto_base_book_id` thành NULL.
- Lịch sử thao tác chức năng "Thiết lập giá": Tạo / Sửa / Xóa / Sửa giá / Áp dụng công thức / Nhập file (`PS/pricebook/PriceBookManageService.java:63-123`).
- **Áp dụng khi bán** (máy POS, offline):
  - server gửi các bảng `active` và `valid_to > now()` có phạm vi chi nhánh chứa chi nhánh bán (`PS/pricebook/SalePriceBookRepository.java:39-42`);
  - client lọc tiếp: `validFrom ≤ thời điểm ≤ validTo`, nhóm khách, người bán (`FE/features/products/price-book-resolver.ts:46-52`). Phạm vi cụ thể mà ngữ cảnh không có giá trị (khách lẻ không nhóm) → không áp dụng.
  - `resolvePrice` (`FE/features/products/price-book-resolver.ts:59-82`):
    - không chọn bảng → giá chung;
    - bảng không còn → giá chung + `BOOK_MISSING`;
    - ngoài hiệu lực/phạm vi → giá chung + `BOOK_NOT_APPLICABLE`;
    - có giá → giá bảng;
    - không có giá: `BLOCK` → không cho thêm (`NOT_IN_BOOK_BLOCKED`); `WARN` → giá chung + `NOT_IN_BOOK`; `ALLOW` → giá chung.

**4. Màn danh sách**
- Sidebar (`FE/features/products/price-book-sidebar.tsx:33-84`):
  - chip bảng giá (mặc định chỉ "Bảng giá chung"; ghi chú "hết hạn" / "chưa áp dụng");
  - "Chỉ hàng có trong bảng giá" (chỉ hiện khi có chọn bảng);
  - nhóm hàng; tồn kho (5 tiêu chí như 1.1; giá trị lạ → 400 `STOCK_FILTER_INVALID`);
  - "Giá bán" `LT|LTE|EQ|GTE|GT` so với Giá vốn / Giá nhập cuối, áp trên **cột đầu tiên** (giá chung nếu cột đầu là bảng giá chung) (`FE/app/(admin)/products/price-books/page.tsx:50-51`).
- Ô tìm: chung (tên không dấu / mã / mã vạch) + "Tìm mã hàng" + "Tìm tên hàng" dưới tiêu đề. Chỉ hàng chưa xóa và đang kinh doanh (`PS/pricebook/PriceBookRowRepository.java:44-99`). Sắp xếp `p.name, p.id, u.sort_order`.
- Cột: Mã hàng, Tên, ĐVT, Giá vốn (theo đơn vị), Giá nhập cuối, Bảng giá chung, từng bảng giá.
- Xuất CSV `thiet-lap-gia-YYYY-MM-DD.csv`: chỉ **các dòng đang hiển thị (trang hiện tại)**; cột "Mã hàng, Tên hàng, ĐVT, Giá vốn, Giá nhập cuối, Giá chung, <tên từng bảng giá>" (trống = không có trong bảng) (`FE/features/products/price-book-csv.ts:7-13`).
- Form bảng giá FE: mặc định hiệu lực từ bây giờ tới +1 năm, Áp dụng, phạm vi Tất cả, ALLOW (`FE/features/products/price-book-form-dialog.tsx:31-38`); kiểm tra trùng phía FE như backend (`FE/features/products/price-book-form-dialog.tsx:57-68`).
- Ô giá: Enter / rời ô = lưu, Esc = hủy, xóa trống + Enter = bỏ khỏi bảng; định dạng phải `^[\d,]+(\.\d+)?$` (`FE/features/products/price-book-price-cell.tsx:43-55`).

---

### 1.7 Kiểm kho

**1. Mục đích / màn hình / API**
- Đếm thực tế, cân bằng tồn. Route `/inventory/stock-takes`, `/inventory/stock-takes/new` (`?edit=<id>` mở phiếu tạm).
- `GET /api/stock-takes`, `GET /{id}` (inventory.view); `POST ?complete=`, `PUT /{id}?complete=`, `POST /{id}/complete`, `POST /{id}/cancel` (inventory.manage) (`PS/inventory/StockTakeController.java:33-85`).

**2. Dữ liệu** (`MIG/V4__stock_take_and_issue_docs.sql:3-43`)
- Mã `KK%06d`, sequence `stock_take_code_seq` (`PS/inventory/StockTakeService.java:102`).
- `stock_takes`: `status`, `taken_at` (= lúc tạo phiếu), `balanced_at`, các cột tổng `actual_qty`, `actual_value`, `diff_value` (làm tròn đồng), `increase_qty`, `decrease_qty` (số dương).
- `stock_take_lines`: 1 dòng = 1 hàng (không lô) hoặc 1 lô; `system_qty`, `actual_qty` (NULL = chưa kiểm), `cost` / đơn vị cơ bản.

**3. Quy tắc**
- **Trạng thái**: `DRAFT` → `BALANCED` (cân bằng) hoặc `DRAFT` → `CANCELLED`. Phiếu đã cân bằng không sửa, không hủy được (`PS/inventory/StockTake.java:30`).
- Sửa phiếu không phải DRAFT → 400 `TAKE_NOT_DRAFT`; hủy phiếu không phải DRAFT → 400 `TAKE_NOT_CANCELLABLE` "Chỉ hủy được phiếu kiểm kho tạm" (`PS/inventory/StockTakeService.java:51-53,84-88`).
- Dòng (`PS/inventory/StockTakeService.java:110-140`):
  - hàng theo lô thiếu số lô → `LOT_REQUIRED`;
  - trùng (hàng, lô) → 400 `DUPLICATE_LINE` "… bị lặp trên phiếu kiểm kho";
  - `actualQuantity` ≥0 "Số lượng thực tế không được âm";
  - HSD lấy từ lô đã có, chỉ dùng HSD gửi lên khi kiểm ra lô mới;
  - mỗi lần lưu tạm chụp lại tồn + giá vốn hiện tại (không khóa).
- **Cân bằng** (`PS/inventory/StockTakeService.java:59-68,142-157`):
  - không dòng nào có `actual` → 400 `TAKE_EMPTY`;
  - kiểm khóa sổ theo **thời điểm hiện tại** (không theo `taken_at`);
  - với dòng đã kiểm: khóa dòng tồn / lô FOR UPDATE, chụp lại `system_qty` + `cost` tại lúc cân bằng, ghi `ADJUSTMENT` với SL = thực tế − tồn, đơn giá = giá vốn (không đổi giá vốn);
  - lô mới (tồn 0, chưa có bản ghi) dùng HSD trên dòng;
  - dòng chưa kiểm giữ nguyên tồn;
  - giảm tồn vẫn qua kiểm âm kho chung (`ADJUSTMENT` không thuộc nhóm cho phép âm).
- **Tổng**: `actual_value = round(Σ actual × cost)`, `diff_value = round(Σ diff × cost)` (`PS/inventory/StockTakeService.java:170-192`).
- `POST /{id}/complete` = cân bằng với dòng đã lưu (`PS/inventory/StockTakeService.java:75-81`).
- Hủy bản nháp không kiểm chi nhánh (`PS/inventory/StockTakeService.java:83-92`).
- Lịch sử thao tác chức năng "Kiểm kho": Lưu tạm / Cân bằng kho / Hủy, kèm lệch tăng/giảm và tổng chênh lệch (`PS/inventory/StockTakeManageService.java:64-71`).
- **FE** (`FE/features/inventory/stock-take-editor.tsx:64-73,99-100`, `FE/features/inventory/stock-take-editor-state.ts:45-56`):
  - thêm hàng theo lô → mỗi lô đang tồn tại chi nhánh thành 1 dòng; không có lô → 1 dòng "lô mới" nhập số lô + HSD;
  - chặn dòng lô thiếu số lô, hoặc lô mới có SL thực tế mà thiếu HSD;
  - cân bằng hỏi xác nhận (báo số dòng chưa kiểm); khóa đổi chi nhánh khi đã có dòng;
  - tab Tất cả / Khớp / Lệch / Chưa kiểm.

**4. Danh sách**
- Lọc (`FE/features/inventory/inventory-queries.ts:9-22`, `PS/inventory/InventoryDocListRepository.java:59-86`):
  - mã (`ILIKE`);
  - trạng thái, **mặc định Phiếu tạm + Đã cân bằng** (`FE/app/(admin)/inventory/stock-takes/page.tsx:31`);
  - thời gian: "Tháng này" (mặc định) hoặc khoảng tùy chọn, theo `taken_at`;
  - người tạo.
- Không gửi `branchId`, nên thấy mọi chi nhánh. Sắp xếp `taken_at desc`.
- Cột: Mã kiểm kho, Thời gian, Ngày cân bằng, SL thực tế, Tổng thực tế, Tổng chênh lệch, SL lệch tăng, SL lệch giảm, Ghi chú, Trạng thái.
- Xuất CSV `kiem-kho-YYYY-MM-DD.csv` (trang hiện tại, thêm cột Chi nhánh, Người tạo); chi tiết `<mã>.csv` (`FE/features/inventory/inventory-csv-export.ts:19-35`).

---

### 1.8 Xuất hủy & xuất dùng nội bộ

**1. Mục đích / màn hình / API**
- Trừ kho không bán (hủy vắc xin hỏng/hết hạn; dùng nội bộ). Route `/inventory/damages(/new)`, `/inventory/internal-use(/new)`.
- `/api/stock-issues?type=DAMAGE|INTERNAL`: GET list, `GET /{id}?type=` (inventory.view); `POST ?type=&complete=`, `PUT /{id}`, `POST /{id}/complete`, `POST /{id}/cancel` (inventory.manage) (`PS/inventory/StockIssueController.java:33-86`).
- `type` sai → 400 `ISSUE_TYPE_INVALID`; id đúng mà khác `type` → 404 `ISSUE_NOT_FOUND` (`PS/inventory/StockIssueManageService.java:63-69`, `PS/inventory/StockIssueService.java:91-94`).

**2. Dữ liệu**
- `stock_issues`: `type` (không cho sửa), `status`, `issued_at`, `reason`(250), `note`, `total_qty`, `total_value` (làm tròn đồng); `stock_issue_lines`: đơn vị đã chọn, `conversion_rate`, `quantity`, `unit_cost` NUMERIC(18,4) / đơn vị đã chọn, lô + HSD (`MIG/V4__stock_take_and_issue_docs.sql:45-78`).
- Mã: xuất hủy `XH%06d` (seq `stock_damage_code_seq`), nội bộ `XNB%06d` (seq `stock_internal_code_seq`) (`PS/inventory/StockIssue.java:33-36`, `PS/inventory/StockIssueService.java:100-101`).

**3. Quy tắc**
- **Trạng thái**: `DRAFT` → `COMPLETED` → `CANCELLED`, hoặc `DRAFT` → `CANCELLED`. Sửa khi không phải DRAFT → 400 `ISSUE_NOT_DRAFT`; hủy phiếu đã hủy → 400 `ISSUE_CANCELLED` (`PS/inventory/StockIssueService.java:45-47,78-80`).
- Dòng: `quantity` ≥0.001 "Số lượng phải > 0"; khi hoàn thành: phiếu rỗng → `ISSUE_EMPTY`, hàng lô thiếu lô → `LOT_REQUIRED` "… chọn lô xuất"; hàng không theo lô thì bỏ số lô (`PS/inventory/StockIssueService.java:107-137`).
- **Giá vốn**: `unit_cost = round4(products.cost × quy đổi)`, tính lại mỗi lần lưu và **chốt lại lúc hoàn thành**; `total_value = round0(Σ qty × unit_cost)` (`PS/inventory/StockIssueService.java:139-150`).
- **Hoàn thành**: kiểm khóa sổ theo `issued_at` (mặc định now), ghi `DAMAGE` / `INTERNAL_USE` âm, đơn giá = `unit_cost / quy đổi` (`PS/inventory/StockIssueService.java:56-63,152-160`). Được âm kho nếu bật thiết lập và hàng không theo lô.
- **Hủy phiếu đã hoàn thành**: kiểm chi nhánh + khóa sổ, nhập lại đúng SL, đúng lô (`DAMAGE_CANCEL` / `INTERNAL_USE_CANCEL`), theo giá đã chốt (`PS/inventory/StockIssueService.java:81-88`). Hủy bản nháp không kiểm chi nhánh.
- Không phát sinh tiền / Sổ quỹ.
- Lịch sử thao tác chức năng "Xuất hủy" / "Xuất dùng nội bộ": Lưu tạm / Hoàn thành / Hủy (`PS/inventory/StockIssueManageService.java:72-78`).
- FE: chặn SL ≤0; hoàn thành mà hàng lô chưa chọn lô → chặn; khóa đổi chi nhánh khi đã chọn lô; giá trị dòng FE = `round(qty × giá vốn)`, chỉ để xem (`FE/features/inventory/stock-issue-editor.tsx:52-59,71`, `FE/features/inventory/stock-issue-editor-state.ts:5-8,38`).

**4. Danh sách**
- Lọc giống 1.7, **mặc định Phiếu tạm + Hoàn thành**, thời gian theo `issued_at` (`FE/features/inventory/stock-issue-list-page.tsx:31`).
- Cột: Mã, Tổng giá trị, Thời gian, Chi nhánh, Ghi chú, Trạng thái.
- CSV `xuat-huy-…csv` / `xuat-dung-noi-bo-…csv` (thêm Lý do, Người tạo); chi tiết `<mã>.csv` (`FE/features/inventory/inventory-csv-export.ts:37-53`).
- Báo cáo xuất hủy: 1.15.

---

### 1.9 Nhập hàng (phiếu nhập)

**1. Mục đích / màn hình / API**
- Route `/purchases/receipts`; `/purchases/receipts/new` với `?edit=` (sửa phiếu tạm), `?copyFrom=` (sao chép thành phiếu mới), `?fromInputInvoice=` (lập từ hóa đơn đầu vào) (`FE/app/(admin)/purchases/receipts/new/page.tsx:16-42`).

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/purchase-receipts?q=&statuses=&from=&to=&createdBy=&receiverId=&inputInvoiceNo=&supplierId=&branchId=` | inventory.view |
| GET | `/api/purchase-receipts/{id}` | inventory.view |
| POST | `/api/purchase-receipts?complete=` | inventory.manage |
| PUT | `/api/purchase-receipts/{id}?complete=` | inventory.manage |
| PATCH | `/api/purchase-receipts/{id}/info` | inventory.manage |
| POST | `/api/purchase-receipts/{id}/cancel` | inventory.manage |

Nguồn: `PS/purchase/PurchaseController.java:35-102`.

**2. Dữ liệu** (`MIG/V2__purchasing_schema.sql:26-70`)
- Mã `PN%06d`, sequence `purchase_receipt_code_seq`, cấp ngay khi tạo (kể cả phiếu tạm) (`PS/purchase/PurchaseReceiptService.java:138-145`).
- `purchase_receipts`: `status`, `received_at`, `receiver_id/name`, `input_invoice_no`(50), `vat_rate` 1 mức cho cả phiếu (NULL = không VAT), `subtotal`, `discount`, `vat_amount`, `total` (= cần trả NCC), `paid_amount` (NUMERIC(18,0)), `payment_method`, `completed_at`, `cancelled_at`.
- Dòng: `conversion_rate` chụp lại, `unit_price` (chưa VAT), `discount` / 1 đơn vị, lô + HSD.

**3. Quy tắc**
- **Validation** (`PS/purchase/PurchaseDtos.java:22-41`): `branchId` NotNull; `vatRate` 0–100; `discount`, `paidAmount` ≥0; `paymentMethod` ≤20 (không giới hạn giá trị); dòng `quantity` ≥0.001 "Số lượng phải > 0", `unitPrice` ≥0, `discount` ≥0, `lotNumber` ≤50.
- **Lưu** (`PS/purchase/PurchaseReceiptService.java:48-80`):
  - chỉ sửa được DRAFT, nếu không → 400 `RECEIPT_NOT_DRAFT` "Chỉ sửa được phiếu tạm";
  - kiểm chi nhánh;
  - NCC không tồn tại → 400 `SUPPLIER_NOT_FOUND`; NCC ngừng hoạt động → 400 `SUPPLIER_INACTIVE` (trừ khi phiếu đã gắn sẵn NCC đó);
  - `received_at` mặc định now;
  - người nhập mặc định = người đang thao tác;
  - **khóa sổ chỉ kiểm khi `complete=true`**.
- **Dòng** (`PS/purchase/PurchaseReceiptService.java:147-192`):
  - hàng phải tồn tại và chưa xóa (`PRODUCT_NOT_FOUND`), đơn vị thuộc hàng (`UNIT_NOT_FOUND` "Đơn vị tính không thuộc hàng …") (`PS/purchase/PurchaseLineSupport.java:53-62`);
  - giảm giá dòng > đơn giá → 400 `DISCOUNT_TOO_LARGE`;
  - khi hoàn thành: phiếu rỗng → `RECEIPT_EMPTY`; hàng lô thiếu số lô hoặc HSD → `LOT_REQUIRED` "… nhập số lô và hạn sử dụng";
  - hàng không theo lô thì bỏ lô / HSD;
  - `paid` làm tròn đồng; `paid > total` → 400 `PAID_TOO_MUCH`.
- **Công thức tiền** (VNĐ, HALF_UP) (`PS/purchase/PurchaseMath.java:7-66`):
  - thành tiền dòng = SL × (đơn giá − giảm/đv);
  - `subtotal = round(Σ thành tiền dòng)`; giảm giá phiếu `= round(min(discount, subtotal))`;
  - `VAT = Σ_dòng round(thành tiền × (1 − giảm phiếu / Σ thô) × VAT%)`, tức làm tròn **từng dòng** rồi cộng;
  - `total = subtotal − giảm phiếu + VAT`.
  - FE có bản sao để tạm tính (`FE/features/purchases/purchase-math.ts:63-75`).
- **Giá vốn mỗi dòng** (/đơn vị cơ bản, 4 lẻ) = `(đơn giá − giảm/đv) × (1 − giảm phiếu / subtotal) × (1 + VAT%) / quy đổi`, tức **gồm VAT** vì đơn vị không khấu trừ VAT đầu vào (`PS/purchase/PurchaseMath.java:16-19,50-62`).
- **Hoàn thành** (`PS/purchase/PurchaseReceiptService.java:194-206`):
  - mỗi dòng ghi `PURCHASE` +SL cơ bản (tạo lô nếu cần), đơn giá = giá vốn dòng, partner = tên NCC; tính lại bình quân;
  - status `COMPLETED`;
  - **Sổ quỹ**: nếu `paid > 0` → outbox `CREATE` phiếu chi `PC{mã PN}` (xem 1.12), kể cả khi phiếu **không có NCC** (`PS/internal/CashflowOutbox.java:45-70`);
  - **Công nợ NCC**: nếu có NCC và `paid > 0` → tạo chứng từ PAYMENT `PC{mã PN}` + phân bổ đúng phiếu này (`PS/purchase/SupplierDebtService.java:121-132`, `PS/purchase/SupplierDebtRepository.java:40-49`).
- **Sửa thông tin** `PATCH /info` (không đụng hàng / tiền) (`PS/purchase/PurchaseReceiptService.java:82-104`):
  - phiếu hủy → 400 `RECEIPT_CANCELLED`;
  - phiếu COMPLETED kiểm khóa sổ cả ngày cũ lẫn ngày mới;
  - đổi được `received_at`, người nhập, số HĐ đầu vào, ghi chú;
  - **không** đồng bộ sang thẻ kho, phiếu `PC…` trong sổ công nợ, hay Sổ quỹ (không thấy code).
- **Hủy** (`PS/purchase/PurchaseReceiptService.java:106-131`):
  - đã hủy → trả về im lặng (idempotent);
  - DRAFT → hủy luôn (không kiểm chi nhánh / khóa sổ);
  - COMPLETED:
    - còn phiếu trả chưa hủy → 400 `RECEIPT_HAS_RETURNS` "Phiếu đã có trả hàng nhập, hãy hủy phiếu trả trước";
    - kiểm chi nhánh + khóa sổ theo `received_at`;
    - trừ lại kho `PURCHASE_CANCEL` theo giá vốn dòng (không đủ tồn → `INSUFFICIENT_STOCK` / `INSUFFICIENT_LOT_STOCK`; không bao giờ cho âm);
    - hủy phiếu `PC{mã}`; phân bổ của các phiếu chi khác thành "chưa phân bổ"; `paid_amount` trừ phần đó (`PS/purchase/SupplierDebtService.java:134-144`);
    - outbox `CANCEL` nếu còn `paid > 0`.
- Lịch sử thao tác chức năng "Nhập hàng": Lưu tạm / Nhập kho / Sửa / Hủy (`PS/purchase/PurchaseManageService.java:51-108`).
- **FE** (`FE/features/purchases/purchase-editor.tsx:43-70`, `FE/features/purchases/purchase-editor-panel.tsx:22,60-104`, `FE/features/purchases/purchase-editor-state.ts:131-142`):
  - VAT chọn: không VAT / 0 / 5 / 8 / 10%;
  - phương thức trả chỉ Tiền mặt / Chuyển khoản (hiện khi `paid > 0`);
  - "Tính vào công nợ" = `max(total − paid, 0)`;
  - hoàn thành mà hàng lô thiếu lô / HSD → chặn;
  - sao chép: bỏ id / mã, ngày = now, xóa số HĐ, tiền trả, ghi chú;
  - ô chọn NCC chỉ NCC đang hoạt động (`FE/features/purchases/purchase-queries.ts:78-84`);
  - ô tìm hàng: hàng đang kinh doanh, 10 kết quả, phím F3 (`FE/features/purchases/search-pickers.tsx:23-30`).
- **Lập từ hóa đơn đầu vào** (`FE/features/integrations/receipt-from-input-invoice.ts:6-26`, `FE/features/purchases/purchase-editor.tsx:52-56`):
  - tìm NCC theo MST người bán; chưa có → `POST /api/suppliers` tạo mới;
  - điền số HĐ, VAT đoán từ HĐ, ghi chú "Lập từ hóa đơn đầu vào …"; dòng hàng do người dùng tự chọn;
  - lưu xong `PATCH /input-invoices/{id}/receipt` (integration-service) gắn mã phiếu; lỗi chỉ báo toast, không rollback phiếu.

**4. Danh sách**
- Lọc (`FE/features/purchases/purchase-filter-sidebar.tsx:27-77`, `PS/purchase/PurchaseListRepository.java:33-106`):
  - mã (`ILIKE`);
  - trạng thái, **mặc định Phiếu tạm + Đã nhập hàng** (`FE/features/purchases/purchase-queries.ts:21-24`);
  - thời gian theo `received_at`: Tháng này (giờ máy) / khoảng tùy chọn;
  - người tạo; số HĐ đầu vào (`ILIKE`); người nhập.
- API còn nhận `supplierId`, `branchId` (FE danh sách không gửi). Sắp xếp `received_at desc`.
- Dòng tổng = Σ toàn bộ kết quả lọc (VAT, cần trả, đã trả, tiền hàng, giảm giá).
- Cột: Mã nhập hàng (gạch ngang nếu hủy), Thời gian, Mã NCC (link), NCC, VAT, Cần trả NCC, Đã trả NCC, Tổng tiền hàng, Giảm giá, Số HĐ đầu vào, Trạng thái.
- CSV `nhap-hang-YYYY-MM-DD.csv` (trang hiện tại; thêm Người nhập, Người tạo); chi tiết `<mã>.csv` gồm cột "Giá nhập có VAT" (`FE/features/purchases/purchase-csv-export.ts:18-46`).
  - "Giá nhập có VAT" backend = `(đơn giá − giảm) × (1 + VAT%)` làm tròn 2 lẻ (`PS/purchase/PurchaseDetailMapper.java:46-49`).
- Panel chi tiết (`FE/features/purchases/receipt-detail-panel.tsx:54-123`):
  - sửa thông tin (khi chưa hủy);
  - Hủy (xác nhận riêng cho DRAFT / COMPLETED); Sao chép; Xuất file;
  - Mở phiếu (DRAFT); Trả hàng nhập (COMPLETED).

---

### 1.10 Trả hàng nhập

**1. Mục đích / màn hình / API**
- Route `/purchases/returns`; `/purchases/returns/new` với `?receiptId=` (trả theo phiếu nhập), `?edit=`, hoặc không tham số (trả nhanh) (`FE/app/(admin)/purchases/returns/new/page.tsx:16-33`).
- `GET /api/purchase-returns?…&returnerId=`, `GET /{id}` (inventory.view); `POST ?complete=`, `PUT /{id}?complete=`, `POST /{id}/cancel` (inventory.manage) (`PS/purchase/PurchaseController.java:106-147`).

**2. Dữ liệu**
- Mã `THN%06d`, sequence `purchase_return_code_seq` (`PS/purchase/PurchaseReturnService.java:99-106`).
- `purchase_returns`: `receipt_id` (NULL = trả nhanh), `returned_at`, `returner_id/name`, `subtotal`, `discount`, `vat_rate`, `vat_amount`, `total` (= NCC cần trả lại), `refund_amount` (= NCC đã trả lại).
- Dòng: `unit_price` = giá trả chưa VAT, lô; không có giảm giá dòng (`MIG/V2__purchasing_schema.sql:72-109`).

**3. Quy tắc**
- Validation: như 1.9; `refundAmount` ≥0 (`PS/purchase/PurchaseDtos.java:72-82`).
- **Lưu** (`PS/purchase/PurchaseReturnService.java:41-79`):
  - chỉ DRAFT, nếu không → `RETURN_NOT_DRAFT`;
  - có `receiptId`: phiếu nhập không tồn tại → 400 `RECEIPT_NOT_FOUND`; phiếu không COMPLETED hoặc khác chi nhánh → 400 `RECEIPT_NOT_RETURNABLE` "Chỉ trả theo phiếu đã nhập tại cùng chi nhánh";
  - NCC luôn lấy theo phiếu nhập (bỏ qua `supplierId` gửi lên);
  - **không chặn NCC ngừng hoạt động** (khác phiếu nhập).
- **Dòng** (`PS/purchase/PurchaseReturnService.java:108-147`): hoàn thành mà rỗng → `RETURN_EMPTY`; hàng lô thiếu lô → `LOT_REQUIRED` "… chọn lô trả"; tiền theo `PurchaseMath` (giảm/dòng = 0); `refund > total` → 400 `REFUND_TOO_MUCH`.
- **Hoàn thành**:
  - kiểm khóa sổ theo `returned_at`;
  - trả theo phiếu: Σ đã trả (các phiếu COMPLETED khác + phiếu này) ≤ đã nhập, so theo (hàng, lô) bằng đơn vị cơ bản, nếu vượt → 400 `RETURN_EXCEEDS_RECEIPT` (`PS/purchase/PurchaseReturnService.java:149-165`);
  - ghi `PURCHASE_RETURN` âm, đơn giá = giá trả gồm VAT, phân bổ giảm giá phiếu, / quy đổi → **tính lại giá vốn bình quân theo giá trả** (`PS/purchase/PurchaseReturnService.java:171-185`);
  - được âm kho nếu bật thiết lập và hàng không theo lô.
- **Hủy** (`PS/purchase/PurchaseReturnService.java:81-92`): COMPLETED → kiểm chi nhánh + khóa sổ, nhập lại `PURCHASE_RETURN_CANCEL` (đổi giá vốn); DRAFT → hủy luôn; gọi lại trên phiếu đã hủy không báo lỗi (ghi đè `cancelled_at`).
- **Công nợ**: phiếu trả COMPLETED giảm nợ NCC `−(total − refund_amount)` qua truy vấn sổ (1.12).
- **Không thấy code** ghi `refund_amount` sang Sổ quỹ hay tạo `supplier_debt_docs` (`PurchaseReturnService` không gọi `CashflowOutbox`).
- Lịch sử thao tác chức năng "Trả hàng nhập": Lưu tạm / Trả hàng / Hủy.
- FE trả theo phiếu nhập: điền sẵn dòng, giá trả = đơn giá nhập − giảm giá, cùng VAT; khóa chi nhánh và NCC (`FE/features/purchases/purchase-editor-state.ts:144-149`, `FE/features/purchases/purchase-editor-panel.tsx:60-66`).

**4. Danh sách**
- Lọc như 1.9 (người trả thay người nhập, không có số HĐ), thời gian theo `returned_at`.
- Dòng tổng gồm Σ `refund_amount`.
- CSV `tra-hang-nhap-YYYY-MM-DD.csv`: Mã, Thời gian, NCC, Tổng tiền hàng, Giảm giá, VAT, NCC cần trả, NCC đã trả, Theo phiếu nhập, Người trả, Trạng thái (`FE/features/purchases/purchase-csv-export.ts:29-37`).

---

### 1.11 Nhà cung cấp & nhóm NCC

**1. Mục đích / màn hình / API**
- Route `/purchases/suppliers`.

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/suppliers?q=&groupId=&active=&buyFrom=&buyTo=&from=&to=&debtFrom=&debtTo=&docCode=&page=&size=` | catalog.view |
| GET | `/api/suppliers/{id}` | catalog.view |
| POST | `/api/suppliers` | inventory.manage |
| PUT | `/api/suppliers/{id}` | inventory.manage |
| PATCH | `/api/suppliers/{id}/note` | inventory.manage |
| PATCH | `/api/suppliers/{id}/status` | inventory.manage |
| DELETE | `/api/suppliers/{id}` | inventory.manage |
| POST | `/api/suppliers/import` (multipart `file`) | inventory.manage |
| GET | `/api/suppliers/groups` | catalog.view |
| POST / PUT / DELETE | `/api/suppliers/groups[/{id}]` | inventory.manage |

Nguồn: `PS/purchase/SupplierController.java:33-107`, `PS/purchase/SupplierGroupController.java:28-61`.

**2. Dữ liệu**
- `suppliers` (`MIG/V2__purchasing_schema.sql:7-23`, `MIG/V6__supplier_groups_and_debt_ledger.sql:17-24`, `MIG/V7__supplier_admin_unit_codes.sql:2`):
  - `code` UNIQUE(30), `name`(250), `phone`(20), `email`, `address`, `province`, `ward`;
  - `province_code` (2 số), `ward_code` (5 số), theo ĐVHC 2 cấp từ 01/07/2025;
  - `group_id` (FK `ON DELETE SET NULL`), `company_name`, `tax_code`, `id_number`;
  - `active`, `branch_id` (chi nhánh tạo, chỉ hiển thị), `created_by`.
- Mã `NCC%06d` từ sequence `supplier_code_seq` khi để trống; mã nhập tay được UPPERCASE (`PS/purchase/SupplierCommandService.java:45-52`).
- `supplier_groups(name(100) UNIQUE lower, note)`.

**3. Quy tắc**
- **Validation** (`PS/purchase/SupplierCommandService.java:20-29`): `name` NotBlank "Nhập tên nhà cung cấp"; `email` hợp lệ "Email không hợp lệ"; `provinceCode` `([0-9]{2})?` "Mã tỉnh/thành phố phải gồm 2 chữ số"; `wardCode` `([0-9]{5})?` "Mã phường/xã phải gồm 5 chữ số" (`CL/address/AdminUnitCodes.java:10-13`).
- Mã trùng (không phân biệt hoa thường) → 409 `SUPPLIER_CODE_EXISTS`. Sửa mà để trống mã thì giữ mã cũ (`PS/purchase/SupplierCommandService.java:61-72`).
- Nhóm: `groupId` ưu tiên (không tồn tại → 400 `SUPPLIER_GROUP_NOT_FOUND`); không có `groupId` thì `groupName` → tìm theo tên, chưa có thì tạo nhóm; cả 2 trống → bỏ nhóm (`PS/purchase/SupplierCommandService.java:115-121`).
- `branch_id` = chi nhánh đầu tiên trong claim của người tạo (`PS/purchase/SupplierCommandService.java:55`).
- **Xóa** = xóa cứng, chỉ khi NCC chưa có chứng từ nào (phiếu nhập, trả, chứng từ công nợ, mọi trạng thái), nếu không → 400 `SUPPLIER_HAS_TRANSACTIONS` "… Hãy chọn Ngừng hoạt động …" (`PS/purchase/SupplierCommandService.java:88-99`, `PS/purchase/SupplierDebtRepository.java:113-120`).
- **Ngừng hoạt động**: không chọn được cho phiếu nhập mới (1.9).
- **Nhóm NCC** (`PS/purchase/SupplierGroupService.java:36-90`): tên NotBlank "Nhập tên nhóm" ≤100; trùng → 409 `SUPPLIER_GROUP_EXISTS`; không có → 404 `SUPPLIER_GROUP_NOT_FOUND`; xóa nhóm → NCC về "Chưa có nhóm".
- **Import** (`PS/purchase/SupplierImportService.java:22-131`, `PS/purchase/SupplierFileParser.java:21-177`):
  - định dạng: `.xlsx` (sheet đầu, chuỗi dùng chung + inline; số dạng "x.0" bỏ ".0"), `.csv` / `.txt` (UTF-8, tự nhận `,` / `;`, ngoặc kép); loại khác → `IMPORT_FILE_TYPE` "Chỉ hỗ trợ file .xlsx hoặc .csv";
  - an toàn: mỗi phần zip ≤20 MB, chặn DOCTYPE (XXE);
  - lỗi file: `IMPORT_FILE_INVALID` / `IMPORT_FILE_EMPTY`;
  - cột nhận theo tiêu đề đã chuẩn hóa (bỏ dấu, ký tự lạ): Mã nhà cung cấp / Mã / Mã NCC; Tên nhà cung cấp / Tên / Tên NCC (**bắt buộc**, thiếu → `IMPORT_HEADER_INVALID`); Điện thoại / Số điện thoại; Email; Địa chỉ; Khu vực / Tỉnh thành phố; Phường xã; Nhóm nhà cung cấp / Nhóm / Nhóm NCC; Mã số thuế / MST; Ghi chú; Tên công ty; Số CCCD/CMND / CCCD/CMND / CCCD;
  - tối đa 5000 dòng → `IMPORT_TOO_MANY_ROWS`; dòng trống bỏ qua;
  - mã trùng NCC cũ → cập nhật **chỉ các cột có trong file**; mã trống hoặc chưa có → thêm mới;
  - file có cột khu vực / phường thì xóa mã ĐVHC cũ;
  - mỗi dòng 1 transaction; lỗi trả `{row (1-based kể cả tiêu đề), message}`;
  - kết quả `{created, updated, errors}`.
- Lịch sử thao tác chức năng "Nhà cung cấp": Thêm mới / Sửa / Xóa / Import.

**4. Danh sách**
- Lọc (`FE/features/purchases/supplier-filter-sidebar.tsx:42-97`, `PS/purchase/SupplierListRepository.java:64-101`):
  - `q`: mã `ILIKE`, tên không dấu, SĐT, MST (escape `%` `_`);
  - nhóm NCC (+ tạo / sửa nhóm);
  - Tổng mua từ–tới + thời gian tính tổng mua (toàn thời gian / khoảng);
  - Nợ hiện tại từ–tới;
  - trạng thái, **mặc định Đang hoạt động** (`FE/features/purchases/supplier-types.ts:61-63`);
  - `docCode` (link sâu từ mã PCN / CKN / DCN → NCC có chứng từ đó).
- **Tổng mua** = Σ `total` phiếu nhập COMPLETED − Σ `total` phiếu trả COMPLETED. **Nợ** = Σ sổ công nợ (1.12).
- Sắp xếp `created_at desc, code desc`; dòng tổng Σ nợ, Σ tổng mua.
- Cột mặc định: Mã, Tên, Điện thoại, Email, Nợ cần trả hiện tại, Tổng mua. Bật thêm: Nhóm, MST, Địa chỉ, Ngày tạo, Trạng thái. Lưu chọn cột ở `localStorage` (`FE/features/purchases/supplier-list-columns.ts:17-29`, `FE/app/(admin)/purchases/suppliers/page.tsx:45-55`).
- **Xuất CSV** `danh-sach-nha-cung-cap.csv` (`FE/app/(admin)/purchases/suppliers/page.tsx:56-73`, `FE/features/purchases/supplier-list-columns.ts:38-41`):
  - NCC đã tích chọn, hoặc toàn bộ kết quả lọc (lấy lần lượt trang 100 dòng);
  - cột tiếng Việt cố định: Mã NCC, Tên, Điện thoại, Email, Địa chỉ, Khu vực, Phường/Xã, Nhóm, Tên công ty, MST, CCCD/CMND, Ghi chú, Nợ cần trả hiện tại, Tổng mua, Trạng thái;
  - **không chặn công thức** (dùng `customer-csv-export`).
- File mẫu import: 12 cột đầu của danh sách trên (`FE/features/purchases/supplier-import-dialog.tsx:19-20`).
- Tab "Lịch sử nhập/trả": mọi phiếu nhập / trả của NCC (mọi trạng thái), mới nhất trước (`PS/purchase/SupplierDebtQueryRepository.java:42-52`).

---

### 1.12 Công nợ NCC (thanh toán, chiết khấu thanh toán, điều chỉnh) + Sổ quỹ

**1. API** (đọc catalog.view, ghi inventory.manage) (`PS/purchase/SupplierDebtController.java:33-93`)
- `GET /api/suppliers/{id}/debts` (sổ), `/history`, `/unpaid-receipts`;
- `POST /api/suppliers/{id}/payments`, `/discounts`, `/adjustments`;
- `GET` / `PATCH /api/suppliers/debt-docs/{docId}`, `POST /api/suppliers/debt-docs/{docId}/cancel`.
- Màn: tab "Nợ cần trả nhà cung cấp" trong chi tiết NCC.

**2. Dữ liệu** (`MIG/V6__supplier_groups_and_debt_ledger.sql:26-65`)
- `supplier_debt_docs`:
  - `kind` `PAYMENT|DISCOUNT|ADJUSTMENT`, `status` `ACTIVE|CANCELLED`, `occurred_at`;
  - `amount` NUMERIC(18,0): PAYMENT / DISCOUNT > 0 (giảm nợ); ADJUSTMENT có dấu (= nợ mới − nợ cũ);
  - `payment_method` `CASH|TRANSFER|EWALLET`, `bank_account_id` (tài khoản ở sales-service), `staff_id/name`;
  - `receipt_id` (phiếu chi lúc nhập hàng), `cash_source_id` (sourceId bên Sổ quỹ).
- `supplier_debt_allocations(doc_id, receipt_id, amount > 0)`.
- Mã: `PCN%06d` (seq `supplier_payment_code_seq`), `CKN%06d` (seq `supplier_discount_code_seq`), `DCN%06d` (seq `supplier_adjust_code_seq`); phiếu chi lúc nhập hàng = `PC` + mã phiếu nhập (`PS/purchase/SupplierDebtService.java:50,65,81`).
- Migration V6 đã tạo lại `PC{mã}` cho phiếu nhập cũ có trả tiền (phiếu nhập hủy → phiếu chi hủy) (`MIG/V6__supplier_groups_and_debt_ledger.sql:67-82`).

**3. Quy tắc**
- **Sổ công nợ** (`v > 0` tăng nợ) (`PS/purchase/SupplierListRepository.java:23-33`):
  - `+total` phiếu nhập COMPLETED có NCC;
  - `−(total − refund_amount)` phiếu trả COMPLETED;
  - `−amount` PAYMENT / DISCOUNT ACTIVE; `±amount` ADJUSTMENT ACTIVE.
  - Số dư lũy kế theo `(thời gian, thứ tự: nhập=0 / trả=1 / chứng từ=2, created_at, id)`, hiển thị mới nhất trước (`PS/purchase/SupplierDebtQueryRepository.java:32-40`).
  - Nợ có thể âm (trả trước).
- **Validation** (`PS/purchase/SupplierDebtDtos.java:27-41`): `branchId` NotNull "Chọn chi nhánh"; `amount` NotNull "Nhập số tiền", ≥1 "Số tiền phải lớn hơn 0"; `paymentMethod` `CASH|TRANSFER|EWALLET` "Phương thức thanh toán không hợp lệ"; điều chỉnh `newDebt` NotNull "Nhập giá trị nợ điều chỉnh".
- Chung khi tạo: kiểm chi nhánh; `occurredAt` mặc định now; kiểm khóa sổ; tiền làm tròn đồng (`PS/purchase/SupplierDebtService.java:146-151`).
- **Thanh toán (PCN)** (`PS/purchase/SupplierDebtService.java:43-57`): phương thức mặc định CASH; ghi chứng từ (`cash_source_id` = id chứng từ); phân bổ; outbox phiếu chi Sổ quỹ (ghi chú mặc định "Thanh toán nhà cung cấp {tên}").
- **Chiết khấu thanh toán (CKN)**: chỉ giảm nợ, **không** có phiếu Sổ quỹ; phân bổ không cộng `paid_amount` (`PS/purchase/SupplierDebtService.java:59-70`).
- **Điều chỉnh (DCN)**: `delta = round(newDebt) − nợ hiện tại`; `delta = 0` → 400 `ADJUSTMENT_NO_CHANGE`; không phân bổ (`PS/purchase/SupplierDebtService.java:72-85`).
- **Phân bổ** (chỉ khi `allocate=true`) (`PS/purchase/SupplierDebtAllocator.java:15-83`):
  - `allocations=null` → tự phân bổ phiếu nhập còn nợ, **cũ trước** (`received_at, code`), mỗi phiếu tối đa "còn cần trả"; phần dư = "chưa phân bổ";
  - dòng ≤0 bỏ qua; trùng phiếu → `ALLOCATION_DUPLICATE`; tổng > số tiền → `ALLOCATION_EXCEEDS`;
  - phiếu nhập khóa FOR UPDATE, phải COMPLETED và đúng NCC, nếu không → `ALLOCATION_RECEIPT_INVALID`;
  - vượt "còn cần trả" (= total − Σ phân bổ ACTIVE của thanh toán + chiết khấu) → `ALLOCATION_EXCEEDS_RECEIPT` "Phiếu X chỉ còn cần trả n";
  - chỉ PAYMENT cộng `purchase_receipts.paid_amount`.
- **Sửa chứng từ** `PATCH` (`PS/purchase/SupplierDebtService.java:87-104`):
  - chỉ thời gian, nhân viên, ghi chú (không đổi tiền);
  - khóa dòng FOR UPDATE; không có → 404 `SUPPLIER_DOC_NOT_FOUND`; đã hủy → 400 `SUPPLIER_DOC_CANCELLED`;
  - kiểm khóa sổ cả ngày cũ lẫn mới;
  - PAYMENT có `cash_source_id` → outbox `UPDATE`.
- **Hủy chứng từ** (`PS/purchase/SupplierDebtService.java:106-119`): kiểm khóa sổ; status CANCELLED; PAYMENT → trừ lại `paid_amount` các phiếu đã phân bổ + outbox `CANCEL`. Áp cho mọi loại, kể cả `PC{mã}` và ADJUSTMENT. Hủy lần 2 → `SUPPLIER_DOC_CANCELLED`.
- **Chi tiết chứng từ**: "Đã chi trước" = phân bổ ACTIVE của chứng từ khác lập trước `(occurred_at, created_at)`; `unallocated = amount − Σ phân bổ` (ADJUSTMENT = 0) (`PS/purchase/SupplierDebtQueryRepository.java:65-96`).
- **Sổ quỹ (cross-service, nội bộ, outbox)** (`PS/internal/CashflowOutbox.java:22-163`):
  - payload ghi vào `outbox_cashflows` **cùng transaction** với nghiệp vụ;
  - job `@Scheduled` mỗi `app.outbox-delay-ms` (mặc định 5000 ms) lấy ≤50 bản ghi chưa gửi (cũ trước) (`PS/internal/CashflowOutboxRepository.java:24-28`), `POST {sales-url}/internal/cashflows` (sales-service, mặc định `http://localhost:8086`) với token service của "product-service";
  - lỗi → `attempts+1`, `last_error`, **dừng ở bản lỗi đầu tiên** để giữ thứ tự CREATE → UPDATE → CANCEL;
  - theo comment, Sổ quỹ nhận idempotent theo `(sourceType, sourceId, action)`.
  - Payload:
    - `CREATE`: `sourceType=PURCHASE`, `voucherType=PAYMENT`, `category="Chi Tiền trả NCC"`, `partnerType=SUPPLIER`;
    - `fund`: TRANSFER→BANK, EWALLET→EWALLET, còn lại CASH (phiếu nhập chỉ phân biệt TRANSFER / CASH);
    - `sourceId` = id phiếu nhập (PC…) hoặc id chứng từ PCN;
    - `UPDATE` (thời gian / người / ghi chú) và `CANCEL` theo `sourceId`.
- **FE** (`FE/features/purchases/supplier-payment-dialog.tsx:39-80`, `FE/features/purchases/supplier-adjust-dialog.tsx:34,39`, `FE/features/purchases/supplier-allocation-math.ts:5-24`):
  - chi nhánh = **chi nhánh đầu tiên** của user (không chọn được);
  - "phân bổ" mặc định bật cho thanh toán, tắt cho chiết khấu;
  - FE tự phân bổ cũ trước để hiển thị; sửa 1 dòng thì kẹp ≤ còn cần trả và số tiền = Σ dòng;
  - TRANSFER / EWALLET chọn tài khoản (sales-service `useBankAccounts`); EWALLET chỉ hiện khi có ví;
  - có in phiếu chi (mẫu `CASH_PAYMENT`);
  - điều chỉnh chỉ bật nút khi giá trị ≠ nợ hiện tại.
- Sổ nợ FE 5 dòng / trang; lọc theo loại; CSV `cong-no-{mã}.csv` (toàn bộ) và `giao-dich-{mã}.csv` (theo lọc), cột Mã phiếu, Thời gian, Loại, Giá trị, Dư nợ (`FE/features/purchases/supplier-detail-debt-tab.tsx:23-76`).
- Lịch sử thao tác chức năng "Nhà cung cấp": Thêm mới / Sửa / Hủy chứng từ công nợ (`PS/purchase/SupplierDebtManageService.java:77-82`).

---

### 1.13 Vị trí (kho / kệ)

- API: `GET /api/positions` (đăng nhập), `POST /api/positions` (catalog.manage); không có sửa / xóa (`PS/catalog/CatalogLookupController.java:63-73`).
- `positions(name(100) UNIQUE)`; tên trim, trùng (không phân biệt hoa thường) → 409 `POSITION_EXISTS` "Vị trí đã tồn tại" (`PS/catalog/CatalogLookupService.java:98-108`). Sắp xếp theo tên.
- Gắn vào hàng qua `products.position_id`; không tồn tại → `POSITION_NOT_FOUND`.

---

### 1.14 Thuế suất (VAT bán ra) + giảm thuế

- `GET /api/tax-rates` (đăng nhập), chỉ đọc, sắp xếp `sort_order` (`PS/catalog/CatalogLookupService.java:88-91`, `PS/catalog/TaxRate.java:13`).
- Seed (`MIG/V1__init_product_schema.sql:116-123`):

| code | Tên | vat_rate |
|---|---|---|
| KCT | KCT (không chịu thuế GTGT) | NULL |
| KKKNT | KKKNT (không kê khai, tính nộp thuế) | NULL |
| VAT0 / VAT5 / VAT8 / VAT10 | 0% / 5% / 8% / 10% | 0 / 5 / 8 / 10 |
| HKD_KCT_15 | KCT GTGT, 1,5% TNCN (sản xuất, vận tải, dịch vụ có gắn với hàng hóa) | NULL |

- `products.tax_reduction` = "Áp dụng giảm thuế" (NQ 204/2025/QH15): màn bán tính 10% → 8%; sales-service tự tra qua `/internal/products/tax-info` (`PS/product/SaleCatalogRepository.java:25-29`, `PS/internal/InternalProductTaxController.java:15-18`).
- VAT đầu vào của phiếu nhập độc lập với bảng này (`vat_rate` nhập tay 0–100, 1.9).

---

### 1.15 Trừ / hoàn kho cho bán hàng (API nội bộ), cảnh báo kho, báo cáo kho/NCC

**Trừ/hoàn kho cho sales-service** — `POST /internal/stock-docs` (quyền `internal`; gọi từ `sales-service/.../invoice/ProductStockClient.java`) (`PS/internal/InternalStockService.java:23-252`):
- **Idempotent**: kết quả lần đầu lưu JSON ở `external_stock_docs` PK `(doc_id, doc_type)`; gọi lại cùng khóa trả kết quả cũ, không trừ lần 2 (`MIG/V3__internal_stock_docs.sql:1-10`, `PS/internal/InternalStockService.java:84-103`). Mỗi lời gọi 1 transaction.
- Các loại:
  - `SALE`: trừ theo `unitId × quantity`; hàng lô dùng FEFO lô còn hạn, hoặc lô chỉ định (1.4);
  - `SALE_CANCEL`: hoàn đúng các lô của chứng từ bán `SALE` / `SALE_REPLACE` / `SALE_MERGE` cùng `docId`;
  - `SALE_REPLACE` (sửa hóa đơn): hoàn `previousDocId` rồi xuất lại theo dòng mới, cùng transaction;
  - `SALE_MERGE` (gộp): cần ≥2 `previousDocIds` (`MERGE_DOCS_REQUIRED`); chứng từ đã hoàn → `STOCK_DOC_CANCELLED`; hoàn từng chứng từ cũ và ghi luôn `SALE_CANCEL` cho chúng; xuất lại đúng lô + giá vốn của dòng gốc theo `sourceLineId` (`MERGE_LINE_NOT_FOUND`);
  - `SALE_RETURN`: nhập lại lô chỉ định theo `baseQuantity`;
  - `SALE_RETURN_CANCEL`: xuất lại (`SALE_RETURN_CANCEL_OUT`);
  - loại khác → `DOC_TYPE_UNSUPPORTED`; không tìm thấy chứng từ gốc → `STOCK_DOC_NOT_FOUND`.
- Giá vốn trả về: `unitCost = round4(cost × quy đổi)` lúc xuất; `SALE_RETURN` trả `cost` hiện tại, quy đổi 1. Bán / trả không đổi giá vốn.
- Hàng đã xóa mềm vẫn trừ / hoàn được (`products.findById` không lọc `deleted`) (`PS/internal/InternalStockService.java:236-239`).

**Cảnh báo kho** (`PS/notification/StockAlertJob.java:21-99`, `PS/notification/StockAlertRepository.java:21-38`):
- Chạy 45 s sau khởi động, sau đó mỗi 15 phút; chạy tay `POST /internal/notification-jobs/run` (internal hoặc settings.manage).
- Gửi trọn bộ cảnh báo đang đúng sang identity (`NotificationClient.sync`), identity tự đóng cảnh báo cũ. Quyền nhận `inventory.view`, theo chi nhánh.
- `LOT_EXPIRING` / `LOT_EXPIRED`: lô còn tồn của hàng chưa xóa, HSD ≤ hôm nay (VN) + N ngày.
- `LOW_STOCK`: hàng đang kinh doanh, `min_stock > 0`, tồn < min, chỉ xét các chi nhánh đã từng có dòng `stock_balances`.

**Báo cáo** (report.view; giới hạn theo claim `branches`: `branchIds` rỗng = mọi chi nhánh được phép, id ngoài claim bị loại; khoảng `[from, to)` sai → 400 `REPORT_RANGE_INVALID`) (`PS/report/ProductReportScope.java:20-29`):
- `GET /api/reports/inventory/movement-detail`: biến động thẻ kho theo hàng × doc_type, `BEFORE` = tồn trước kỳ; định giá như S2d (`PS/report/InventoryReportRepository.java:33-46`).
- `GET /api/reports/inventory/damages` và `/damages/monthly`: phiếu xuất hủy COMPLETED theo `issued_at`; giá trị = Σ `round(qty × unit_cost)`; tháng theo giờ VN.
- `GET /api/reports/suppliers/summary?byProduct=`: giá trị nhập / trả = tổng cộng phiếu (gồm VAT, sau giảm) phân bổ theo tỷ lệ tiền hàng dòng (`PS/report/SupplierReportRepository.java:27-36`).
- `GET /api/reports/suppliers/debt`: nợ đầu kỳ / phát sinh nợ / phát sinh có / cuối kỳ; điều chỉnh dương vào nợ, âm vào có (`PS/report/SupplierReportRepository.java:62-87`).
- `GET /api/reports/suppliers/payment-discounts/monthly`: Σ CKN ACTIVE theo tháng (Thu nhập khác).

---

### 1.16 Đồng thời, idempotency, giới hạn (tổng hợp)

| Chủ đề | Hành vi trong code |
|---|---|
| Sinh mã | Sequence Postgres (SP, NCC, PN, THN, KK, XH, XNB, PCN, CKN, DCN): an toàn đồng thời; mã có thể nhảy số (cấp cả khi lưu tạm hoặc khi transaction rollback) |
| Khóa tồn | `stock_balances` + `product_lots` `PESSIMISTIC_WRITE`; bán FEFO khóa `stock_balances` trước khi đọc lô |
| Khóa công nợ | `supplier_debt_docs` và `purchase_receipts` `SELECT … FOR UPDATE` khi phân bổ / sửa / hủy |
| Khóa phiếu | Không có `@Version` hay khóa dòng trên phiếu nhập / trả / kiểm / xuất; trạng thái DRAFT kiểm bằng đọc thường |
| Idempotent | `/internal/stock-docs` theo `(docId, docType)`; outbox Sổ quỹ gửi lại tới khi thành công; hủy phiếu nhập đã hủy trả về im lặng; hủy xuất hủy / chứng từ công nợ đã hủy → lỗi; POST tạo phiếu không có khóa idempotency phía client |
| Giới hạn | size API ≤100; giá theo lô ≤2000 dòng / lần; import giá ≤5000 dòng; import NCC ≤5000 dòng, phần zip ≤20 MB; tax-info ≤500 id; outbox 50 bản / lượt |
| Làm tròn | Tiền chứng từ: đồng HALF_UP; VAT làm tròn từng dòng; giá vốn 4 lẻ HALF_UP; công thức bảng giá `round(…,0)` ≥0; tổng kiểm kho / xuất hủy làm tròn đồng |

### 1.17 Điểm chưa có / giới hạn đã thấy trong code

- Chuyển hàng giữa chi nhánh: chỉ có enum `TRANSFER_OUT/IN` và danh sách loại được phép âm, không có API (`PS/stock/StockLedgerEntry.java:26`).
- Cột "Khách đặt" (`reserved`) không được service nào trong product-service ghi.
- Tiền NCC hoàn khi trả hàng nhập (`refund_amount`) không sinh phiếu thu Sổ quỹ, không sinh chứng từ công nợ riêng.
- Thẻ kho ghi theo thời điểm hoàn thành chứng từ, không theo ngày chứng từ; sửa `received_at` không đồng bộ thẻ kho / `PC…` / Sổ quỹ.
- Giá vốn là 1 giá cho mọi chi nhánh nhưng công thức bình quân dùng tồn của 1 chi nhánh.
- Danh sách hàng hóa / phiếu nhập / trả / kiểm / xuất và sổ S2d không lọc theo chi nhánh của user (báo cáo `report/*` thì có).
- Hủy phiếu tạm (nhập, trả, kiểm, xuất) không kiểm chi nhánh; tồn đầu kỳ khi tạo hàng và lưu tạm không kiểm khóa sổ; cân bằng kiểm kho kiểm khóa sổ theo thời điểm hiện tại.
- Nhóm hàng không chặn vòng cha–con nhiều cấp; truy vấn đệ quy không có điều kiện dừng.
- "Dự kiến hết hàng" lọc `doc_type in ('SALE','RETURN')`; `RETURN` không có trong enum (`PS/product/ProductListRepository.java:45`).
- FE phiếu nhập chỉ có CASH / TRANSFER; backend nhận `payment_method` tự do ≤20 ký tự.
- Payment / discount / adjust NCC trên FE luôn lấy chi nhánh đầu tiên của user.
- CSV danh sách NCC, sổ nợ NCC và hóa đơn đầu vào không chặn công thức Excel.
- `LocalDate.now()` (múi giờ JVM) dùng để xét lô hết hạn khi bán, trong khi job cảnh báo dùng giờ VN (`PS/internal/InternalStockService.java:148,231` và `PS/notification/StockAlertJob.java:55`).

**Câu hỏi chưa giải quyết**
- Theo comment, sales-service `/internal/cashflows` idempotent theo `(sourceType, sourceId, action)`; chưa kiểm phía sales-service (ngoài phạm vi).
- `TRANSFER_*` và `reserved` có thuộc kế hoạch tính năng khác không? Code không ghi.


---

## 2. Bán hàng, hóa đơn, trả hàng, đặt hàng

Quy ước trích dẫn (viết tắt đường dẫn):
- `S/` = `backend/sales-service/src/main/java/com/vaxclinic/sales/`
- `M/` = `backend/sales-service/src/main/resources/db/migration/`
- `F/` = `frontend/src/`
- `CL/` = `backend/common-lib/src/main/java/com/vaxclinic/common/`

Tiền VNĐ lưu `NUMERIC(18,0)`; đơn giá/giảm giá dòng `NUMERIC(18,2)`; SL `NUMERIC(18,3)`; giá vốn `NUMERIC(18,4)` (`M/V1__init_sales_schema.sql`). Ghi chú: code đặt hàng + hủy hóa đơn đang bị agent khác sửa trong lúc đọc (xem §2.9). Tài liệu này mô tả code tại thời điểm đọc.

---

### 2.1 Mã chứng từ, dãy số và bảng chính

| Mã | Sinh ở | Sequence / quy tắc | Ghi chú |
|---|---|---|---|
| `HD%06d` hóa đơn | `S/invoice/InvoiceService.java:103`, gộp đơn `S/invoice/InvoiceMergeService.java:112` | `invoice_code_seq` (`M/V1:2`) | Mã được lấy TRƯỚC khi trừ kho. Bước sau lỗi thì mã bị bỏ, dãy số có thể nhảy (`InvoiceService.java:102`). Import giữ mã trong file (`fixedCode`). |
| `TT{mã HĐ}` phiếu thu chính | `S/invoice/InvoiceWriter.java:100` | theo mã HĐ | `source_type=INVOICE`, `source_id`=id HĐ |
| `TT{mã HĐ}-2`, `-3`… phiếu thu thêm | `S/invoice/InvoiceExtraPayments.java:51-55` | đánh số từ 2 theo thứ tự trong request | `source_type=INVOICE_EXTRA` |
| `TH%06d` phiếu trả | `S/salesreturn/SalesReturnService.java:103`, `QuickReturnService.java:102` | `sales_return_code_seq` (`M/V3:23`) | lấy trước khi gọi kho |
| `PC{mã TH}` phiếu chi trả khách | `S/salesreturn/SalesReturnWriter.java:98` | theo mã TH | `source_type=RETURN` |
| `DH%06d` đơn đặt hàng | `S/order/OrderService.java:61` | `order_code_seq` (`M/V7:4`) | |
| `TT{mã DH}`, `TT{mã DH}-n` phiếu thu cọc | `S/order/OrderDepositLedger.java:51-52` | phiếu đầu không hậu tố; phiếu thứ n có hậu tố `-n` (n = số phiếu đã có + 1) | `source_type=ORDER` |
| `PC{mã DH}` phiếu chi hoàn cọc | `S/order/OrderDepositLedger.java:68` | theo mã DH | `source_type=ORDER` |
| `VD%06d` vận đơn | `S/delivery/ShipmentInvoiceHooks.java:61` | `shipment_code_seq` (`M/V10:4`) | tạo cùng HĐ bán giao hàng |
| `KH…`, `PT…`, `PC…`, `DC…`, `CKTT…` | `M/V1:1-6` | các sequence khác | thuộc phần khách hàng / sổ quỹ |

- Không có mã `TTHD…` riêng. Phiếu thu tự động của HĐ là `"TT" + code`, ví dụ `TTHD000123` (`InvoiceWriter.java:100`).
- `cash_vouchers.code` là UNIQUE (`M/V1`). Nếu 2 thao tác cùng sinh `PC{mã}` thì thao tác sau bị lỗi do ràng buộc unique. Ví dụ: hủy đơn có hoàn cọc → phiếu `PC{DH}` là duy nhất.
- Chống trùng phiếu tự động: unique index `(source_type, source_id)` chỉ áp cho `INVOICE`, `PURCHASE` (`M/V1:133-134`).
- Bảng chính:
  - `invoices`, `invoice_lines`, `invoice_line_lots`: lô đã xuất theo đơn vị cơ bản, `lot_number=''` = hàng không theo lô (`M/V3:13-18`).
  - `checkout_attempts` (`M/V14`).
  - `sales_returns`, `sales_return_lines`, `sales_return_line_lots` (`M/V3`).
  - `customer_orders`, `customer_order_lines` (`M/V7`).
  - `cash_vouchers`, `voucher_allocations`, `customer_debt_ledger` (`M/V1`).
  - `sales_channels`: seed `DIRECT` (builtin) / `FACEBOOK` / `ZALO` / `WEBSITE` / `PHONE` (`M/V9:15-20`).
- Cột thêm của `invoices`:
  - `revision`, `stock_doc_id` (V3); `order_id` (V7); `price_book_id/name`, `sales_channel` (default `DIRECT`) (V9);
  - `einvoice_*` (V13); `updated_at`, có trigger tự cập nhật mỗi lần UPDATE (`M/V17:5-15`); `merged_into_id` (V17);
  - `tax_reduction`, `prescription*` (V19); `tax_reduction_method` có CHECK `DEDUCTION|DIRECT` (`M/V20`).
- Tìm kiếm không dấu: hàm `immutable_unaccent` + GIN trigram trên `customers.name` và `invoices.customer_name` (`M/V15`).

---

### 2.2 Màn bán hàng (POS) — route `/sale`

**Mục đích:** bán toàn màn hình, chạy được khi mất mạng (`F/app/sale/page.tsx`, `F/features/sale/sale-screen.tsx:46`). Route này nằm ngoài layout quản trị và nạp sẵn mọi namespace i18n (`F/app/sale/layout.tsx`).

**API màn bán hàng gọi**

| Việc | API |
|---|---|
| Danh mục | `GET /api/products/sale-catalog?branchId=&withPriceBooks=true` (`use-sale-catalog.ts:25`) |
| Thanh toán | `POST /api/invoices` |
| Sửa hóa đơn | `PUT /api/invoices/{id}?revision=` |
| Xem trước giảm thuế | `POST /api/invoices/tax-reduction-preview` |
| Giá gần nhất | `GET /api/invoices/last-prices?customerId=&productIds=`; `GET /api/invoices/recent-prices?productId=&customerId=` |
| Chọn hóa đơn trả | `GET /api/invoices/returnable` |
| Trả hàng | `POST /api/sales-returns` |
| Đặt hàng | `POST /api/orders`, `PUT /api/orders/{id}`; `GET /api/orders/sale-search` |
| Khách hàng | `GET /api/customers?q=&size=10`; thu nợ `POST /api/customers/{id}/payments` (`sale-receipt-dialog.tsx:63`) |
| Kênh bán + đối tác | `GET /api/sales-channels`, `GET /api/delivery-partners?active=true&size=200` (`use-sale-lookups.ts:22`) |
| QR | `GET /api/bank-accounts/{id}/vietqr`, `GET /api/payments/sepay/settings`, `POST /api/payment-requests`, `GET /api/payment-requests/{code}` |
| Lô (trả nhanh) | `GET /api/products/{id}/lots` |

**Tab (phiếu đang soạn)** — `F/features/sale/use-sale-tabs.ts`, kiểu ở `sale-types.ts:80-112`

- Loại `kind`:
  - `SALE`: bán mới.
  - `EDIT`: sửa HĐ, nhãn `Update_HDxxx`.
  - `RETURN`: trả theo HĐ (`returnOf`) hoặc trả nhanh (`quickReturn`).
  - `ORDER`: đặt hàng; `orderOf` = đang sửa đơn đã lưu.
  - Tab `SALE` có `fromOrder` = tạo hóa đơn từ đơn đặt hàng.
- Tab lưu localStorage theo user: khóa `sale.tabs.{userId}`, gồm `{tabs, activeId, counter}` (`use-sale-tabs.ts:39-57`, `sale-storage.ts:35-42`). Luôn còn ít nhất 1 tab: đóng tab cuối thì tạo tab trống mới (`:76-88`).
- Tab mới (`:20-23`):
  - `mode=QUICK`, `salesChannel=DIRECT`, `priceBookId=null`.
  - `paymentMethod` = thiết lập "phương thức mặc định".
  - `paid=null` (= trả đủ) nếu bật `paidEqualsDue`, ngược lại `0`.
  - Tab đặt hàng luôn `paid=null`, nhưng hiển thị/tính là `0` (`:26`, `:150`).
- Sau khi thanh toán / đặt hàng: tab biến thành tab trống cùng loại, id mới, giữ `mode` (`:91-98`).
- Mở lại 1 HĐ / đơn đã có tab (cùng `editOf`, `returnOf`, `orderOf` hoặc `fromOrder`) → chỉ chuyển sang tab đó, không mở tab mới (`:101-113`).
- Bản lưu cũ được bổ sung `priceBookId=null`, `salesChannel=DIRECT`, `priceEdited=false` (`sale-price-book-pricing.ts:59-61`).

**Chế độ bán** (`sale-footer`, `sale-screen.tsx:181-183`)

- `QUICK`: bán nhanh.
- `NORMAL`: bán thường. Giỏ hàng chiếm nửa trên, lưới hàng nửa dưới (`:165-166`).
- `DELIVERY`: bán giao hàng, bố cục 3 cột (`:146`).
- Đổi sang hoặc ra khỏi `DELIVERY` → reset `paid=null` và `extraPayments=[]`.
- Tab ORDER không có chế độ DELIVERY (`allowDelivery`); tab RETURN không có chọn chế độ.
- Backend: `saleMode` regex `QUICK|NORMAL|DELIVERY`, mặc định `QUICK` (`S/invoice/InvoiceDtos.java:56`, `InvoiceWriter.java:79`). Có `delivery` → `sale_mode` bị ép thành `DELIVERY` (`InvoiceWriter.java:94`).

**Chi nhánh** (`use-sale-branch.ts`)

- Chỉ chọn được chi nhánh user được phân công. Lựa chọn nhớ theo máy ở khóa `sale.branch.{userId}`; mặc định chi nhánh đầu tiên.
- Đổi chi nhánh → tải lại danh mục và bảng giá; giỏ hàng giữ nguyên.
- Backend kiểm tra `actor.checkBranch(branchId)`; branch không nằm trong claim `branches` của JWT → `BRANCH_NOT_ALLOWED` "Bạn không làm việc tại chi nhánh này" (`S/common/Actor.java:19-23`).

**Danh mục & offline**

- Danh mục lưu ở khóa `sale.catalog.{branchId}`, tự làm mới mỗi 5 phút và sau mỗi lần bán (`use-sale-catalog.ts:13-41`).
- Tìm hàng bỏ dấu tiếng Việt; ưu tiên khớp đúng mã đơn vị hoặc mã vạch; tối đa 20 kết quả (`:47-61`).
- Đăng ký service worker `/sw.js` để mở được màn khi mất mạng (`sale-screen.tsx:87`).
- Khách tìm được lưu ở khóa `sale.customers`, tối đa 500 khách gần nhất. Mất mạng thì tìm trong bản lưu (`sale-customer-picker.tsx:35-46`, `:100-104`).
- Kênh bán + đối tác giao hàng lưu ở khóa `sale.lookups`.

**Bảng giá** (`use-sale-price-book.ts`, `sale-price-book-pricing.ts`)

- Danh sách chọn = bảng giá áp dụng được theo (chi nhánh, nhóm khách, người bán, thời điểm). `null` = "Bảng giá chung".
- Đổi bảng giá → tính lại giá các dòng chưa sửa tay; dòng `priceEdited` giữ nguyên. `discount` bị chặn ≤ giá mới (`pricing.ts:42-56`).
- Bảng giá chặn hàng ngoài bảng → dòng bị bỏ khỏi giỏ. Trước khi bỏ có `window.confirm` (`use-sale-price-book.ts:29-31`).
- Thêm hàng bị chặn → không thêm, hiện cảnh báo. Có cảnh báo nhưng không chặn → vẫn thêm (`sale-add-product.ts:36-38`).
- Đổi khách / người bán mà bảng giá không còn áp dụng (hoặc bị xóa) → tự về Bảng giá chung + thông báo (`use-sale-price-book.ts:39-47`).
- Mở HĐ / đơn đã lưu: các dòng đặt `priceEdited=true` để giữ giá cũ (`sale-open-invoice.ts:14-26`).
- Server lưu `price_book_id`; `price_book_name` chỉ được lưu khi có `priceBookId` (`InvoiceWriter.java:198-202`). Server KHÔNG kiểm tra giá theo bảng giá.

**Giỏ hàng / dòng hàng**

- Thêm hàng đã có cùng đơn vị khi bật "Gộp hàng hóa liên quan" (`mergeSameItems`, mặc định bật) → +1 SL; ngược lại thêm dòng mới ở đầu giỏ (`sale-add-product.ts:30-42`).
- Đổi đơn vị tính → lấy lại giá theo bảng giá, `discount=0`, `priceEdited=false` (`sale-cart-line.tsx:74-80`).
- SL không âm; sửa đơn giá → `priceEdited=true`, discount ≤ đơn giá (`:86-88`).
- "Chỉnh sửa thành tiền" (`editAmount`): đơn giá = `round(thành tiền / SL) + giảm giá` (`:89-91`).
- Giảm giá dòng là số tiền / 1 đơn vị. Nhập theo % (tối đa 100%) → `round(đơn giá × % / 100)`, chặn ≤ đơn giá (`:110-116`). Kiểu mặc định theo thiết lập `discountType` (VND).
- Server: `DISCOUNT_TOO_LARGE` "{tên}: giảm giá lớn hơn đơn giá" khi giảm giá > đơn giá (`S/invoice/InvoiceMath.java:28-34`).
- Validate dòng (`InvoiceDtos.java:24-33`):
  - `productCode` ≤ 50, `productName` ≤ 250, `unitName` ≤ 50, `note` ≤ 500, `taxCode` ≤ 30.
  - `quantity ≥ 0.001` ("Số lượng phải > 0"); `unitPrice ≥ 0`; `discount ≥ 0`.
  - `lines` không rỗng ("Hóa đơn chưa có hàng").
- Client chặn SL ≤ 0 trước khi gửi (`sale-screen.tsx:114`).
- Lô khi bán: client không chọn lô. product-service tự phân bổ FEFO và trả về `allocations`; server lưu vào `invoice_lines.lots` dạng `"LOT:qty"` (qty theo đơn vị cơ bản, làm tròn xuống) và `invoice_line_lots` (`S/invoice/InvoiceLineBuilder.java:44-61`). Chỉ import file mới chỉ định lô (§2.7).
- Xem giá gần nhất:
  - `recent-prices`: 10 lần bán gần nhất từ HĐ `COMPLETED`, ưu tiên đúng khách (`S/invoice/InvoiceQueryRepository.java:110-121`).
  - `last-prices`: lần bán gần nhất cho khách theo từng (hàng, đơn vị), `price = đơn giá − giảm giá` (`InvoiceSaleLookupRepository.java:40-52`).
  - Giá gần nhất hiện trên dòng khi bật `showLastPrice` và có mạng.

**Giảm giá hóa đơn & nhóm khách**

- Chọn khách thuộc nhóm có giảm giá (`sale-checkout-panel.tsx:44-49`):
  - Nhóm `PERCENT` → `discountPercent`; giảm giá được tính lại theo giỏ.
  - Nhóm `AMOUNT` → `discount` cố định.
  - Bỏ chọn khách khi đang giảm theo % nhóm → về 0.
  - Sửa tay ô giảm giá → bỏ % (`:91-92`).
- Client: `discount = min(round(subtotal × % / 100 hoặc số tiền), subtotal)` (`use-sale-tabs.ts:136-139`).
- Server: `discount = min(round_half_up(discount), subtotal)` (`InvoiceMath.java:43`). Server chỉ nhận số tiền; % chỉ tồn tại ở client.

**Công thức tổng** (server `S/invoice/InvoiceMath.java:10-49`, client `use-sale-tabs.ts:136-154`)
- `thành tiền dòng = round_half_up(SL × (đơn giá − giảm giá/đv))`, làm tròn tới đồng; `tổng tiền hàng = Σ thành tiền dòng`.
- `khách cần trả (total) = tổng tiền hàng − giảm giá HĐ − giảm thuế`.
- Tab có đơn đặt hàng: `deposit = cọc`; `due = max(0, total − deposit)`.
- `paid` mặc định:
  - Tab ORDER, hoặc bán giao hàng chưa phải sửa → 0.
  - Còn lại = `due`.
- `cod = max(0, due − paid)` khi `mode=DELIVERY` và chưa tắt `codEnabled`.

**Giảm thuế NQ 204/2025/QH15** (`S/invoice/InvoiceTaxReduction.java`, `TaxReductionPlanner.java`)
- Cửa sổ áp dụng 01/07/2025 – 31/12/2026, xét theo ngày bán giờ VN (`InvoiceTaxReduction.java:24-49`). Client chỉ hiện nút trong cửa sổ này (`sale-tax-reduction.ts:8-15`).
- Ngoài cửa sổ → không giảm dù có bật. HĐ sửa dùng `soldAt` gốc (`InvoiceService.java:133`).
- Dòng được giảm do server tự tra; bỏ qua cờ `taxReducible` client gửi (`InvoiceDtos.java:32`, `TaxReductionPlanner.java:19-53`):
  - Cờ "Áp dụng giảm thuế" + mã thuế lấy từ product-service: `POST /internal/products/tax-info`.
  - Phương pháp + ngành nghề lấy từ identity-service: `GET /internal/settings/tax` (`TaxReductionLookupClient.java:51-68`).
  - Gọi được 1 trong 2 thất bại → 503 `TAX_LOOKUP_DOWN` "Không tra được … để tính giảm thuế, vui lòng thử lại".
- `DEDUCTION` (khấu trừ): dòng có cờ và `taxCode="VAT10"` → giảm = doanh thu × 2/110.
- `DIRECT` (trực tiếp): dòng có cờ và tỷ lệ ngành > 0 → giảm = doanh thu × tỷ lệ% × 20% (hệ số `0.002`).
  - Ngành tìm theo `categoryPath` (nhóm gần nhất đã gắn ngành → nhóm cha), không có thì ngành mặc định (`TaxReductionPlanner.java:56-62`).
- Doanh thu dòng = thành tiền dòng × (sau giảm giá HĐ / tổng tiền hàng); ratio scale 10. Làm tròn HALF_UP 1 lần trên tổng (`InvoiceTaxReduction.java:52-68`).
- Lưu `tax_reduction`, `tax_reduction_method` (null khi giảm = 0) và cờ `tax_reduced` từng dòng (`InvoiceWriter.java:91-95`).
- Client:
  - Gọi preview (debounce 300 ms); kết quả gắn với khóa giỏ hàng (`use-sale-tax-preview.ts`).
  - Mất mạng → ước tính kiểu khấu trừ VAT10 (`sale-tax-reduction.ts:24-28`).
  - Tab ORDER và RETURN không có giảm thuế.

**Bán thuốc theo đơn** (`sale-prescription-fields.tsx`)
- Tích chọn → nhập mã đơn (≤ 50), bác sĩ (≤ 150), cơ sở khám (≤ 250), chẩn đoán (≤ 500) (`InvoiceDtos.java:44-46`).
- `prescription != null` → `prescription=true`; ô trống → null (`S/invoice/Invoice.java:155-161`).
- Vẫn là HĐ bán thường, trừ kho như thường. Chưa kết nối Hệ thống Đơn thuốc Quốc gia (`M/V19:1`).

**Thông tin xuất HĐĐT trên HĐ** (`sale-einvoice-dialog.tsx`)
- Các trường: buyerName ≤ 200, companyName ≤ 250, taxCode ≤ 20, address ≤ 500, email ≤ 150 (phải hợp lệ), phone ≤ 20 (`InvoiceDtos.java:82-86`).
- Tất cả trống → null; khi đó lấy theo hồ sơ khách (`Invoice.java:135-152`).
- Dialog tự điền từ hồ sơ khách nếu có mạng (`sale-einvoice-dialog.tsx:52-55`).
- Lưu ý: endpoint `/internal/invoices/{id}` cho integration-service hiện lấy người mua từ hồ sơ khách (`buyerName`/`name`, `companyName` khi `COMPANY`, MST, địa chỉ/email/SĐT xuất HĐ, fallback thông tin chung; khách lẻ = "Khách lẻ"). Endpoint này KHÔNG đọc `einvoice_*` của HĐ (`S/invoice/InternalInvoiceService.java:43-56`).

**Thanh toán (Khách thanh toán)**
- Phương thức: `CASH|TRANSFER|CARD|EWALLET` (`InvoiceDtos.java:58`).
  - Quỹ: `TRANSFER`/`CARD` → `BANK`; `EWALLET` → `EWALLET`; còn lại `CASH` (`InvoiceWriter.java:204-210`).
- Server `paid = min(round(paidAmount ?? total), total)` (`InvoiceService.java:191-193`). Tiền thừa không lưu; chỉ client hiển thị "Tiền thừa trả khách" = `paid − due` (`sale-checkout-panel.tsx:99`).
- Phần thiếu:
  - Khách có tài khoản: hiện "Tính vào công nợ".
  - Tab đặt hàng: hiện "Thanh toán khi giao" (`:100-102`).
- Ô gợi ý số tiền (`suggestPaid`, mặc định bật; ẩn ở tab đặt hàng và bán giao hàng): đúng số cần trả + làm tròn lên theo bước 10k/50k/100k/200k/500k/1tr, không trùng, tối đa 6 ô (`sale-suggested-amounts.ts`).
- Thanh toán nhiều phương thức — chỉ HĐ bán mới; không có ở tab đặt hàng và tab sửa (`sale-checkout-panel.tsx:98`):
  - Phương thức nhiều tiền nhất thành phương thức chính (`sale-mixed-payment-dialog.tsx:39-44`).
  - Tổng phi tiền mặt > số cần trả → báo lỗi; chỉ tiền mặt được vượt.
  - Client chia lại trước khi gửi: phần thừa trừ ở tiền mặt trước, rồi phương thức chính, rồi các khoản khác (`sale-payment-split.ts`).
  - Sửa tay số tiền hoặc đổi phương thức → xóa chia nhiều phương thức (`sale-paid-section.tsx:35-38`).
  - Server (`InvoiceService.java:90-97`):
    - `extras = Σ round(amount)`, mỗi khoản `amount ≥ 1`.
    - `extras > due` → `EXTRA_PAYMENT_EXCEEDS`; đồng thời trả lại giữ chỗ đơn đặt hàng.
    - `paid = min(paid, due − extras)`.
  - Mỗi khoản thêm = phiếu thu `TT{mã}-n` (§2.3).
- QR (`F/features/sales/qr-payment-dialog.tsx`):
  - VietQR theo tài khoản + số tiền; bấm QR → tự đặt phương thức `TRANSFER`.
  - Bật SePay: tạo payment-request, poll 3 giây/lần; nhận đủ → set `paid` + `TRANSFER`.
  - Thiết lập `autoCompleteQr` → tự bấm thanh toán (`sale-checkout-panel.tsx:69-72`, `:111-115`).
  - Tab sửa HĐ không nhận báo có.
- Ví: chỉ là phương thức `EWALLET` → quỹ `EWALLET`; không có logic riêng.

**Khách lẻ vs khách có nợ**
- Khách lẻ (`customerId=null`, `customer_name="Khách lẻ"`):
  - Phải trả đủ `paid + extras ≥ total` → `WALK_IN_DEBT` "Khách lẻ phải thanh toán đủ — chọn khách hàng để ghi nợ" (`InvoiceService.java:98-101`).
  - Ngoại lệ: bán giao hàng có thu hộ (`codEnabled != false`).
  - Client kiểm tra trước (`sale-invoice-body.ts:47-51`, `sale-screen.tsx:111`).
- Khách có tài khoản: phần chưa trả thành nợ trong sổ công nợ (§2.3).
- Cảnh báo vượt hạn mức nợ (`shop.customer.debtLimit`) chỉ hiển thị ở client (`sale-customer-picker.tsx:51-53`). sales-service không chặn theo hạn mức.
- Khách không tồn tại → `CUSTOMER_NOT_FOUND` (`InvoiceService.java:186-189`).

**Người bán / kênh bán / thời gian**
- `sellerId` null → người bán = người thao tác (`InvoiceWriter.java:74-75`).
- Kênh bán trống → `DIRECT`. Kênh không tồn tại hoặc đã ngừng (trừ kênh hiện tại của HĐ) → `CHANNEL_NOT_FOUND` (`S/channel/SalesChannels.java:32-42`).
- `soldAt`: client gửi giờ máy lúc tạo body (`sale-invoice-body.ts:16`); null → `now()`. Khi sửa HĐ client gửi `soldAt: undefined`.

**Hàng đợi offline & đồng bộ** (`use-offline-queue.ts`, `sale-sync-dialog.tsx`)
- Lỗi mạng = `TypeError` hoặc HTTP 502/503/504 (`sale-storage.ts:48-52`).
- Có thể xếp hàng offline: HĐ bán mới (`use-sale-invoice-submit.ts:76-82`), phiếu trả (`use-sale-return-submit.ts:49-53`), đơn đặt hàng mới (`use-sale-order-submit.ts:37-41`).
- Không xếp hàng (bắt buộc có mạng): sửa HĐ, sửa đơn, HĐ tạo từ đơn đặt hàng (`use-sale-invoice-submit.ts:74-75`).
- Body lưu nguyên kèm `offline=true` ở khóa `sale.queue`. Đồng bộ khi có sự kiện `online` và mỗi 15 giây. POST lại đúng endpoint (`QUEUE_PATH`):
  - Thành công → xóa khỏi hàng đợi.
  - Lỗi nghiệp vụ → `status=error` + lý do, giữ lại.
  - Lỗi mạng → dừng lượt đồng bộ.
- Thao tác tay: gửi lại / xóa / đồng bộ tất cả (đưa cả phiếu lỗi về `pending`).
- Server không tạo trùng vì id do máy sinh (`InvoiceService.java:73-75`, `SalesReturnService.java:63-65`, `OrderService.java:49-52`).
- HĐ offline đồng bộ muộn mang ngày bán cũ; ngày đó thuộc kỳ khóa sổ → `BOOK_LOCKED`, phiếu nằm lại trong hàng đợi (`InvoiceService.java:77-78`).

**Sau thanh toán** (`use-sale-invoice-submit.ts:63-72`)
- Toast hiện mã HĐ, mã vận đơn và tiền thừa.
- `speakPaid`: đọc số tiền bằng Web Speech.
- `autoPrint` (F2): in ngay.
- Thiết lập in lưu theo máy (`sale-settings.ts`): `autoPrint=false`, `mergePrintLines=false`, `printCopies` 1–10 (mặc định 1).
  - In bằng mẫu `INVOICE`; HĐ có vận đơn chưa hủy dùng mẫu `DELIVERY_INVOICE` (`use-sale-invoice-printer.ts:26-41`).
  - Gộp hàng khi in: cùng mã + đơn vị + đơn giá + giảm giá (`:11-20`).

**Phím tắt** (`sale-shortcuts.ts:13-19`)
- F1 thêm HĐ · F2 bật/tắt tự in · F3 tìm hàng · F4 tìm khách · F6 chế độ nhập SL · F8 ô khách trả · F9 thanh toán · F11 toàn màn hình.
- Home / ↑ / ↓ / Enter / Shift: thao tác trên dòng; không chạy khi đang gõ trong ô chữ, trừ ô SL.
- Kèm Ctrl/Alt/Meta → bỏ qua.

**Mở tab từ URL** (`use-sale-url-drafts.ts`)
- `?edit=` sửa HĐ, `?return=` trả HĐ, `?copy=` sao chép HĐ, `?order=` sửa đơn, `?orderInvoice=` tạo HĐ từ đơn, `?returnPicker=1`, `?new=1`.
- Sao chép mang theo khách, dòng (giá cũ), giảm giá, kênh bán, bảng giá, ghi chú; không mang tiền đã trả và vận đơn. Áp dụng được cả HĐ đã hủy (`sale-open-invoice.ts:88-101`).
- Sửa HĐ (`:57-70`):
  - HĐ phải `COMPLETED`.
  - `paid` = `inv.paid`; riêng HĐ từ đơn đặt hàng chỉ lấy phần phiếu `TT{mã}`.
  - Vận đơn chưa hủy → `mode=DELIVERY`.

**Import file trên POS** (`sale-import-parse.ts`): mỗi trang tính = 1 tab HĐ; tối đa 19 trang × 250 dòng. Chỉ dựng tab, chưa lưu (`sale-screen.tsx:122-129`).

**Menu ☰** (`sale-main-menu.tsx`): Quản lý (`/invoices`, tab mới), Báo cáo cuối ngày, Xử lý đặt hàng, Chọn HĐ trả hàng, Lập phiếu thu (thu nợ; cần mạng), Import, Thiết lập, Phím tắt, Đăng xuất.

---

### 2.3 Thanh toán tại quầy — backend `POST /api/invoices`

Quyền `sales.perform` (`S/invoice/InvoiceController.java:68-72`). Luồng `InvoiceService.create` (`S/invoice/InvoiceService.java:72-123`) không mở transaction:

1. Id đã tồn tại → trả HĐ cũ (idempotent).
2. `checkBranch`.
3. `checkNotLocked(branch, soldAt ?? now)`.
4. Kiểm tra giao hàng:
   - `DELIVERY_REQUIRED`: chế độ DELIVERY mà thiếu thông tin giao.
   - `DELIVERY_MODE`: có thông tin giao nhưng không ở chế độ DELIVERY.
   - `PARTNER_NOT_FOUND`: đối tác không tồn tại hoặc ngừng hoạt động.
   - Nguồn: `S/delivery/ShipmentInvoiceHooks.java:39-53`.
5. Kiểm tra kênh bán; tra khách.
6. Tính tổng (+ giảm thuế).
7. Nếu có `orderId`: giữ chỗ đơn và lấy tiền cọc (§2.9).
   - `due = total − min(deposit, total)`; `paid = min(paid, due)`.
8. Kiểm tra extras, rồi kiểm tra khách lẻ.
9. Cấp mã HĐ; tạo id dòng tất định `UUID(id + ":" + i)` (`:105-106`).
10. `checkouts.begin` (§2.4) → lấy `stockDocId`.
11. Gọi kho `SALE` qua `ProductStockClient` → `POST {product-url}/internal/stock-docs`.
    - Nội bộ, JWT dịch vụ của `sales-service`.
    - Idempotent theo `(docId, docType)`.
    - Timeout đọc `app.http.stock-read-timeout`, mặc định 10s (`S/invoice/ProductStockClient.java:20-102`).
    - Kho trả 4xx → lỗi chuyển nguyên `code/message`, mã mặc định `STOCK_ERROR`, checkout → `FAILED`.
    - Lỗi mạng → 503 `STOCK_SERVICE_DOWN`, checkout giữ `PENDING` (`InvoiceService.java:171-179`).
12. `InvoiceWriter.persist` (1 transaction).
13. Bất kỳ lỗi nào trong khối try → trả lại giữ chỗ đơn đặt hàng (`:115-118`).
14. Audit "Hóa đơn/Tạo".
15. Sau khi lưu: `ShipmentInitialStatus.apply` chuyển vận đơn sang trạng thái chọn ở POS nếu hợp lệ; lỗi chỉ ghi log (`S/invoice/InvoiceManageService.java:50-54`).

`InvoiceWriter.persist` (`S/invoice/InvoiceWriter.java:56-135`):
- Id đã có (2 lần gửi song song) → return.
- `checkouts.markDone(id, stockDocId)` trong cùng transaction.
  - Thất bại mà HĐ chưa có → 409 `CHECKOUT_RECONCILED` "Lần thanh toán này đã được đối soát hoàn kho, vui lòng gửi lại hóa đơn".
- Ghi HĐ `status=COMPLETED`.
  - `payment_method`:
    - `paid > 0` → phương thức chính (mặc định `CASH`).
    - `paid = 0` → phương thức của khoản thêm đầu tiên.
    - Không có gì → null (`:83-84`).
  - Ghi dòng + `invoice_line_lots`.
  - `cost` = `unitCost` kho trả về (`InvoiceLineBuilder.java:44`).
- Phiếu thu `TT{mã}` (khi `paid > 0`): `RECEIPT`, category "Thu Tiền khách trả", quỹ theo phương thức, `bank_account_id` từ request, `occurred_at = sold_at`, `partner_type=CUSTOMER`, người thu = người bán, `accounting=false` (doanh thu đã nằm trong HĐ), `affects_debt = có khách`, `source_type=INVOICE`. Phân bổ toàn bộ vào HĐ.
- `CashbookWriter.save` (`S/cashbook/CashbookWriter.java:35-58`):
  - Số tiền ≤ 0 → `AMOUNT_INVALID`.
  - Tổng phân bổ > phiếu → `ALLOCATION_EXCEEDS`.
  - Phân bổ vào HĐ không `COMPLETED` hoặc vượt còn nợ → `ALLOCATION_INVALID`.
  - `invoices.paid` luôn bằng Σ phân bổ của phiếu còn hiệu lực.
- Phiếu thêm `TT{mã}-n`: cùng thuộc tính, `source_type=INVOICE_EXTRA`, note "Thanh toán nhiều phương thức hóa đơn …" (`InvoiceExtraPayments.java:44-75`).
- Có `orderId` → `orderDeposits.attach`: phân bổ phiếu cọc, đơn → `COMPLETED` (§2.9).
- Có `delivery` → tạo vận đơn `VD…` ở `PENDING`:
  - `cod = total − paid` (sau phiếu thu + cọc), hoặc 0 nếu tắt thu hộ.
  - `fee_payer` mặc định `SHOP`.
  - Ghi log "Tạo vận đơn từ hóa đơn …" (`ShipmentInvoiceHooks.java:55-66`, `:127-134`).
- Sổ công nợ (chỉ khách có tài khoản; `DebtLedger.post` bỏ qua amount = 0 và khóa dòng khách, `S/debt/DebtLedger.java:33-45`):

  | doc_type | Số tiền | Mã chứng từ |
  |---|---|---|
  | `SALE` | `+total` | `HDxxx` |
  | `PAYMENT` | `−paid` | `TTHDxxx` |
  | `PAYMENT` | `−amount` | mỗi `TT…-n` |

  - Cùng lúc `customers.total_sales += total`.
  - Tiền cọc KHÔNG ghi sổ lần 2: đã giảm nợ lúc thu cọc (`InvoiceWriter.java:119`).

---

### 2.4 Idempotency & đối soát `checkout_attempts`

- Mục đích: thanh toán đi qua 2 dịch vụ (trừ kho ở product-service, lưu HĐ ở sales-service). Bảng này chặn trường hợp "kho đã trừ nhưng không có HĐ" (`M/V14:1-5`).
- Trạng thái: `PENDING | DONE | FAILED | COMPENSATING | COMPENSATED` (`S/invoice/checkout/CheckoutAttempt.java`).
- `begin` (transaction riêng, commit ngay) (`CheckoutAttemptService.java:36-49`):
  - `insert … on conflict do nothing`, rồi `SELECT … FOR UPDATE`.
  - Chọn round:
    - Lần đầu → round 1, `stock_doc_id` = id HĐ.
    - Đang `PENDING`/`FAILED`/`DONE` → giữ nguyên chứng từ kho.
    - `COMPENSATED` → round+1, `stock_doc_id = UUID(id + ":checkout:" + round)`. Phải dùng doc mới vì product-service chống trùng theo `(doc_id, doc_type)`; gửi lại doc cũ sẽ không trừ kho (`CheckoutAttemptRules.java:8-48`).
    - `COMPENSATING` → 409 `CHECKOUT_RECONCILING` "Hóa đơn đang được đối soát kho, vui lòng thử lại sau ít phút".
  - Ghi `payload_hash` (SHA-256 JSON request), `summary` ("mã · n dòng · tổng · khách"), `doc_code`, `updated_at = now`.
- `markFailed`: kho từ chối 4xx → chưa trừ gì.
- `markDone(id, stockDocId)`: chỉ chuyển khi đang `PENDING` và đúng doc (`CheckoutAttemptRepository.java:49-53`).
- Job đối soát (`CheckoutReconcileScheduler.java:20-21`):
  - Chạy lần đầu 1 phút sau khởi động (`app.checkout.reconcile-initial-delay`), sau đó mỗi 5 phút (`app.checkout.reconcile-interval`).
  - Mỗi lượt lấy tối đa 50 dòng `PENDING`/`COMPENSATING` có `updated_at` cũ hơn 5 phút (`CheckoutReconciler.java:42-56`).
  - Xử lý từng dòng (`CheckoutAttemptRules.java:54-66`, `CheckoutReconciler.java:58-101`):
    - Đã có HĐ → `DONE` (tự lành).
    - Chưa có HĐ → `COMPENSATING` → kho `SALE_CANCEL` cùng `stock_doc_id` → `COMPENSATED`.
  - Kho trả `STOCK_DOC_NOT_FOUND` → coi như chưa từng trừ, vẫn `COMPENSATED`, không báo.
  - Lỗi khác → giữ `COMPENSATING` + `last_error`; lượt sau làm tiếp.
  - Hoàn kho thật → gửi thông báo "Hộp thư đến" loại `CHECKOUT_COMPENSATED` (`CheckoutCompensationNotifier.java:11-42`):
    - Người nhận: quyền `sales.perform`, theo chi nhánh.
    - dedupe key `checkout_compensated:{id}:{round}`.
    - Tiêu đề "Thanh toán {mã} - {khách} không lưu được hóa đơn, đã hoàn kho".
- Tạo / sửa / gộp HĐ, trả hàng, đơn đặt hàng đều idempotent theo id do client sinh. Id dòng và doc kho đều tất định từ id đó (`InvoiceService.java:104-106`, `:135-138`; `SalesReturnService.java:89`; `InvoiceMergeService.java:117`).

---

### 2.5 Hóa đơn — route `/invoices`

**API** (`S/invoice/InvoiceController.java`, `InvoiceToolsController.java`, `InvoiceSaleLookupController.java`)

| Method + path | Quyền | Việc |
|---|---|---|
| `GET /api/invoices` | `sales.perform` hoặc `report.view` | danh sách; `size` 1–100 (mặc định 15), `page` ≥ 0 (`:56-59`) |
| `GET /api/invoices/{id}` | như trên | chi tiết + dòng + lịch sử thanh toán |
| `POST /api/invoices` | `sales.perform` | tạo (§2.3) |
| `PUT /api/invoices/{id}?revision=` | `sales.perform` | sửa từ POS |
| `PATCH /api/invoices/{id}/tax-codes` | `sales.perform` | sửa mã thuế từng dòng |
| `PATCH /api/invoices/{id}/info` | `sales.perform` | sửa người bán / thời gian / kênh / ghi chú |
| `POST /api/invoices/{id}/cancel?cancelPayments=false` | `sales.cancel` | hủy (`:109-114`) |
| `POST /api/invoices/tax-reduction-preview` | `sales.perform` | xem trước giảm thuế |
| `GET /api/invoices/recent-prices` | `sales.perform` hoặc `report.view` | 10 giá gần nhất |
| `GET /api/invoices/last-prices`, `GET /api/invoices/returnable` | `sales.perform` | tra cứu ở POS; `returnable` mặc định 7 dòng, tối đa 50 (`InvoiceSaleLookupService.java:26-30`) |
| `GET /api/invoices/export?detail=` | `sales.perform` hoặc `report.view` | xuất file |
| `POST /api/invoices/import` | `sales.perform` | import file |
| `GET /api/invoices/merge-candidates?branchId=`, `POST /api/invoices/merge` | `sales.perform` (merge thêm `sales.cancel`) | gộp đơn |
| `GET /internal/invoices/{id}` | `internal` | dữ liệu phát hành HĐĐT (`InternalInvoiceController.java`) |

**Trạng thái**
- Lưu trong DB: `COMPLETED | CANCELLED` (`M/V1`). Không có chuyển trạng thái ngược.
- Hiển thị (`S/invoice/InvoiceFilterSql.java:25-32`), dựa trên vận đơn còn hiệu lực mới nhất:

  | Trạng thái hiển thị | Điều kiện |
  |---|---|
  | `CANCELLED` | HĐ đã hủy |
  | `FAILED_DELIVERY` | vận đơn ở `WAIT_RETURN`, `RETURNING`, `WAIT_RERETURN` hoặc `RETURNED` |
  | `PROCESSING` | vận đơn ở `PENDING`, `PICKING`, `PICKED`, `WAIT_REPICK`, `DELIVERING` hoặc `WAIT_REDELIVER` |
  | `COMPLETED` | còn lại |

- Client tự tính lại chỉ với `RETURNING`/`RETURNED` và `PENDING`/`PICKING`/`DELIVERING` (`F/features/sales/invoice-filter-model.ts:50-55`). Tập trạng thái khác server.

**Sửa HĐ** (`PUT`, `InvoiceService.update` `:129-143`, `InvoiceChangeGuard.java:46-97`, `InvoiceEditWriter.java`). Kiểm tra theo thứ tự:
1. HĐ phải `COMPLETED`, ngược lại `INVOICE_NOT_EDITABLE`.
2. `revision` khớp, ngược lại 409 `INVOICE_CHANGED` "Hóa đơn vừa được người khác sửa…".
3. Còn phiếu trả `COMPLETED` → `INVOICE_HAS_RETURNS`.
4. `checkBranch`; khóa sổ theo `sold_at` gốc.
5. Thiết lập `blockEditPublishedEInvoice` (mặc định bật, `CL/settings/ShopSettings.java:23-26`):
   - Đã phát hành → `EINVOICE_PUBLISHED`.
   - Gọi `GET /internal/einvoices/{id}/published` lỗi → 503 `EINVOICE_SERVICE_DOWN`, chặn để an toàn (`S/common/SalesRules.java:42-59`).
6. Vận đơn đã qua giai đoạn lấy hàng (khác `PENDING`/`PICKING`/`WAIT_REPICK`) → `SHIPMENT_IN_PROGRESS`.
7. Kênh bán hợp lệ.
8. Khách lẻ trả thiếu và không thu hộ → `WALK_IN_DEBT`.
9. HĐ có phiếu thu thêm:
   - `paid` < tổng thu thêm → `INVOICE_EXTRA_PAYMENTS`.
   - Đổi khách → `INVOICE_EXTRA_PAYMENTS` "không đổi khách hàng được".
   - Hợp lệ: `paid −= extras`. Phiếu thêm giữ nguyên; chỉ `TT{mã}` thay đổi.
10. `debtPayments = paid HĐ − TT − extras` (phiếu thu nợ + cọc). Nếu > 0 mà đổi khách, hoặc `total` mới < `debtPayments + extras + paid` → `INVOICE_HAS_PAYMENTS`.

Thực hiện sửa:
- Kho `SALE_REPLACE`: `docId = UUID(id + ":" + revisionMới)`, `previousDocId = stock_doc_id` cũ. product-service hoàn lô cũ và xuất lô mới trong 1 transaction.
- Ghi DB (`InvoiceEditWriter.java:53-145`):
  - Gửi lại đúng bản sửa đã ghi → `return`.
  - Thay toàn bộ dòng + lô; cập nhật tổng, khách, người bán (nếu gửi), ghi chú, bảng giá, kênh, HĐĐT buyer, đơn thuốc.
  - `revision + 1`, `stock_doc_id` mới.
  - Phiếu `TT{mã}`: hủy rồi tạo lại theo số mới, dùng lại cùng bản ghi; giữ người tạo cũ.
  - `payment_method`: có TT → phương thức request; không TT mà có extras → giữ phương thức cũ; còn lại null.
  - Vận đơn: chưa có thì tạo; còn trước lấy hàng thì cập nhật thông tin + COD; đã lấy hàng thì bỏ qua (`ShipmentInvoiceHooks.java:77-93`).
  - Sổ nợ:
    - Cùng khách: `SALE` ghi Δtotal, `PAYMENT` ghi `TT cũ − TT mới`; `total_sales += Δ`.
    - Đổi khách: khách cũ `SALE_CANCEL −oldTotal` và `PAYMENT_CANCEL +oldTT`; khách mới `SALE +total` và `PAYMENT −paid`. Note "Sửa hóa đơn {mã}".
- FK `sales_return_lines.invoice_line_id` là `ON DELETE SET NULL` nên dòng của phiếu trả đã hủy không chặn việc thay dòng (`M/V4`).
- Audit "Sửa" (`InvoiceManageService.java:56-63`).
- Client: sửa phải có mạng; không có chia nhiều phương thức (`use-sale-invoice-submit.ts:51-62`).

**Sửa thông tin** (`PATCH /info`, `InvoiceService.java:163-174`, `InvoiceWriter.java:187-201`)
- Áp cho HĐ ở bất kỳ trạng thái nào; server không kiểm tra `status`. Client chỉ cho sửa khi `COMPLETED` (`invoice-detail-panel.tsx`).
- Khóa sổ xét theo `sold_at` cũ.
- Đổi `soldAt`:
  - Thiết lập `lockTransactionTime` bật → `TIME_CHANGE_BLOCKED` "Cửa hàng không cho phép thay đổi thời gian giao dịch".
  - Khóa sổ xét thêm theo `soldAt` mới.
- `sellerId` null → giữ người bán cũ; `salesChannel` null → giữ kênh cũ.
- `note` luôn bị ghi đè: gửi null sẽ xóa ghi chú (`InvoiceWriter.java:200`).
- Không kiểm tra chi nhánh của người thao tác (không gọi `checkBranch`).

**Sửa mã thuế** (`PATCH /tax-codes`, `InvoiceWriter.java` `updateTaxCodes`)
- Dòng không thuộc HĐ → `LINE_NOT_FOUND`.
- Server không kiểm tra trạng thái HĐ, đã phát hành HĐĐT hay khóa sổ.
- Client vô hiệu hóa mục này khi HĐĐT đã `PUBLISHED` (`invoice-detail-footer.tsx:44`).

**Hủy HĐ** (`InvoiceService.cancel` `:150-160`, guard `InvoiceChangeGuard.java:99-113`, writer `InvoiceWriter.java:145-176`)
- HĐ đã `CANCELLED` → return (idempotent).
- Kiểm tra: `checkBranch`, khóa sổ theo `sold_at`, HĐĐT đã phát hành (`EINVOICE_PUBLISHED`), vận đơn đã lấy hàng (`SHIPMENT_IN_PROGRESS`).
- `paid > TT + extras + cọc đã phân bổ` (còn phiếu thu nợ phân bổ) → `INVOICE_HAS_PAYMENTS` "…hãy hủy các phiếu thu đó trước".
- Còn phiếu trả `COMPLETED` → `INVOICE_HAS_RETURNS` "…hãy hủy phiếu trả trước".
- Kho `SALE_CANCEL` với `stock_doc_id` hiện hành, lines rỗng.
- Ghi DB (1 transaction, khóa HĐ):
  - Hủy `TT{mã}` và mọi `TT{mã}-n`; trả lại phân bổ.
  - Có `order_id` → `detach`: gỡ phân bổ cọc; đơn về `CONFIRMED`, bỏ `invoice_id`/`invoicing_id`. `cancelPayments=true` → hủy luôn các phiếu cọc của đơn (§2.9).
  - `status=CANCELLED`, `cancelled_at=now`.
  - Vận đơn còn trước lấy hàng → `CANCELLED` + log "Hủy hóa đơn …" (`ShipmentInvoiceHooks.java:95-105`).
  - Sổ nợ: `SALE_CANCEL −total` ("Hủy hóa đơn"); `PAYMENT_CANCEL +TT`; `PAYMENT_CANCEL +` từng extra ("Hủy phiếu thu"); `total_sales −= total`.
- Audit "Hủy".
- Client: nút Hủy chỉ hiện với quyền `sales.cancel` và HĐ `COMPLETED`, có `confirm()`. Client không gửi `cancelPayments` (`invoice-detail-panel.tsx:57`).

**Danh sách: bộ lọc, cột, tổng** (`InvoiceFilterSql.java:51-83`, `invoice-filter-model.ts`, `invoice-filter-sidebar.tsx`)
- Tham số server:

  | Tham số | Điều kiện |
  |---|---|
  | `q` | mã HĐ ilike, tên khách không dấu, mã KH, SĐT |
  | `customerQ` | tên khách không dấu, mã KH, SĐT |
  | `productQ` | mã/tên hàng trên dòng |
  | `noteQ` | ghi chú |
  | `ids`, `statuses`, `states` | danh sách id / trạng thái lưu / trạng thái hiển thị |
  | `from` / `to` | `sold_at ∈ [from, to)` |
  | `createdBy`, `sellerId`, `paymentMethods`, `customerId`, `branchId` | bằng giá trị |
  | `deliveries` | `DELIVERY`/`NONE`; chọn cả 2 hoặc không chọn = không lọc |
  | `returnStates` | `HAS`/`NONE`; tương tự |
  | `einvoiceStatuses` | `NONE`/`PUBLISHED`/`ACCEPTED`/`FAILED`, lấy id từ `GET /internal/einvoices/statuses` |
  | `einvoiceNatures` | chỉ `ORIGINAL` có kết quả (= đã phát hành); `ADJUST`/`REPLACE` luôn rỗng |

- Sắp xếp `sold_at desc, code desc`. Dòng tổng: `count`, Σ subtotal / discount / total / paid.
- Mặc định client: thời gian "Tháng này"; trạng thái `PROCESSING` + `COMPLETED`; trả hàng cả `NONE` + `HAS`.
- Link sâu `?code=` / `?id=`: toàn thời gian, mọi trạng thái, mở sẵn chi tiết. `?einvoice=PUBLISHED,ACCEPTED`: lọc HĐĐT, toàn thời gian (`F/app/(admin)/invoices/page.tsx:25-39`).
- Ô tìm kiếm debounce 300 ms. ☆ yêu thích lưu ở khóa `kv.invoices.favourites.{userId}`; "chỉ yêu thích" lọc theo `ids` (`invoice-list-prefs.ts`).
- Cột chọn được, lưu ở khóa `kv.invoices.columns.{userId}`; Mã HĐ luôn hiện (`invoice-list-prefs.ts:46-63`):
  - Mặc định: Thời gian, Mã trả hàng, Mã KH, Khách hàng, Tổng tiền hàng, Giảm giá, Khách cần trả, Khách đã trả, Trạng thái HĐĐT.
  - Còn lại: mã/trạng thái vận đơn, thời gian tạo, ngày cập nhật, mã đặt hàng, email/SĐT/địa chỉ/khu vực/phường/ngày sinh KH, chi nhánh, MST người bán, người bán, người tạo, kênh, đối tác, ghi chú, COD, phí ĐTGH, thời gian giao, trạng thái, tính chất / số / ký hiệu HĐĐT.
- Chi tiết HĐ:
  - Sửa người bán / ngày bán (khóa nếu `lockTransactionTime`) / kênh / ghi chú → Lưu.
  - Thẻ HĐĐT: trạng thái, số-ký hiệu, link tra cứu meinvoice.vn theo `transaction_id`.
  - Tab Lịch sử giao hàng; tab Lịch sử thanh toán (mọi phiếu phân bổ vào HĐ).
  - Footer: Hủy · Sao chép · Xuất file (1 HĐ) · Chỉnh sửa · Lưu · Trả hàng · In · "…" Sửa thuế.
  - Chỉnh sửa / Trả hàng / In chỉ hiện khi HĐ `COMPLETED` (`invoice-detail-footer.tsx`).
- Trạng thái HĐĐT ở client (`invoice-einvoice-state.ts`): không có bản ghi → `NONE`; `status=FAILED` → `FAILED`; có `inv_code` → `ACCEPTED` ("CQT chấp nhận"); còn lại → `PUBLISHED`.

---

### 2.6 Gộp đơn

- Endpoint: `GET /api/invoices/merge-candidates`, `POST /api/invoices/merge`. Quyền `sales.perform` và `sales.cancel` (`InvoiceToolsController.java:51-62`). Chi tiết ở `S/invoice/InvoiceMergeService.java`, `InvoiceMergeWriter.java`, `InvoiceMergeRepository.java`.
- Ứng viên:
  - HĐ `COMPLETED` cùng chi nhánh, bán trong 7 ngày gần nhất (`WINDOW_DAYS=7`).
  - Nhóm theo `customer_id`; khách lẻ nhóm theo `walkin:` + tên viết thường. Chỉ trả nhóm ≥ 2 HĐ.
  - Không có nhóm nào → `reason` = `ORDER_NOT_COMPLETED` hoặc `NO_CANDIDATES` (`:55-72`, `InvoiceMergeDtos.java:17-50`).
- Lý do chặn từng HĐ (`:131-149`):

  | Mã | Nghĩa |
  |---|---|
  | `ORDER_NOT_COMPLETED` | đơn đặt hàng liên quan chưa `COMPLETED` |
  | `HAS_RETURN` | đã có phiếu trả |
  | `HAS_SHIPMENT` | có vận đơn chưa hủy |
  | `EINVOICE_PUBLISHED` | đã phát hành hoặc CQT chấp nhận; không hỏi được integration → 503, không gộp |
  | `FOREIGN_PAYMENT` | có phiếu còn hiệu lực phân bổ vào HĐ mà không do chính HĐ sinh (thu nợ / cọc) |

- Validate request:
  - `id` (id HĐ mới, do client sinh); `invoiceIds` 2–50 phần tử (`@Size`).
  - Sau khi bỏ trùng còn < 2 → `MERGE_TOO_FEW`.
  - Thiếu HĐ → `INVOICE_NOT_FOUND`.
  - Bị chặn hoặc quá 7 ngày → `MERGE_NOT_ALLOWED`.
  - Khác khách → `MERGE_DIFFERENT_CUSTOMERS`.
  - Khác chi nhánh → `MERGE_DIFFERENT_BRANCH`.
  - Khóa sổ theo từng HĐ gốc.
  - Id đã tồn tại → trả HĐ đã gộp.
- Kho `SALE_MERGE`: hoàn các `previousDocIds` rồi xuất lại đúng lô cho dòng mới (`sourceLineId`); tồn kho không đổi (`ProductStockClient.java:67-87`).
- Ghi DB (khóa HĐ gốc theo id tăng dần để tránh deadlock):
  - HĐ gốc không còn `COMPLETED` → 409 `INVOICE_ALREADY_CANCELLED`.
  - HĐ mới:
    - Khách / chi nhánh / `sale_mode` theo HĐ sớm nhất; người bán và `sold_at` theo HĐ mới nhất.
    - Tổng (subtotal / discount / total / paid) = Σ các HĐ gốc.
    - Ghi chú "Gộp từ hóa đơn …".
    - Bảng giá / kênh: giữ nếu mọi HĐ gốc giống nhau, ngược lại null / kênh của HĐ đầu.
    - Dòng copy nguyên (giá, giá vốn, lô, mã thuế) + copy `invoice_line_lots`.
    - Số dòng lệch với lúc kiểm tra → 409 `INVOICE_CHANGED`.
  - HĐ gốc → `CANCELLED`, `paid=0`, `merged_into_id` = HĐ mới; đơn đặt hàng trỏ sang HĐ mới.
  - Phiếu thu: chuyển phân bổ sang HĐ mới. Phiếu `TT` đầu tiên thành phiếu chính `INVOICE`, còn lại thành `INVOICE_EXTRA`; mã phiếu giữ nguyên, sổ quỹ không đổi.
  - Sổ nợ: `SALE_CANCEL −total` từng HĐ gốc ("Gộp vào hóa đơn …") + `SALE +total` HĐ mới; các dòng thanh toán giữ nguyên.
  - Audit "Gộp đơn".
- Giới hạn thấy trong code: writer không copy `tax_reduction`, `tax_reduction_method`, cờ `tax_reduced` của dòng, đơn thuốc, thông tin HĐĐT buyer; `total` vẫn là Σ total đã trừ giảm thuế (`InvoiceMergeWriter.java:65-109`). `customers.total_sales` không cần chỉnh vì Σ không đổi.

---

### 2.7 Import / Export hóa đơn

**Import** (`POST /api/invoices/import`; `S/invoice/InvoiceImport*.java`; client `F/features/sales/invoice-import-dialog.tsx`, `invoice-import-template.ts`)
- Request: `{id, branchId, rows}`.
  - Tối đa 2000 dòng (`MAX_ROWS`); rỗng → "File không có dòng dữ liệu nào".
  - `id` = mã lần import, sinh mỗi lần mở dialog; bấm lại không tạo trùng (`InvoiceImportDtos.java:22-36`).
- File mẫu `MauFileHoaDon.xlsx`:
  - Dòng 1 = nhóm cột, dòng 2 = tên cột (tiếng Việt cố định), dữ liệu từ dòng 3.
  - Nhận `.xlsx`, `.xls`, `.csv`.
  - Ô ngày dạng serial Excel được chuyển thành `dd/MM/yyyy [HH:mm]`.
- Kiểm tra TOÀN BỘ file trước. Có lỗi → trả danh sách lỗi theo số dòng Excel, không lưu gì (`InvoiceImportService.java:52-62`).
- Các dòng cùng mã HĐ (không phân biệt hoa thường) = 1 HĐ; thông tin chung lấy ở dòng đầu.
  - Id HĐ = `UUID(importId + ":" + MÃ)`. Mã đã tồn tại với đúng id này → `skipped` (`InvoiceImportPlanner.java:65-74`).
- Quy tắc mã HĐ (`:76-79`):
  - Thiếu mã → "Thiếu Mã hóa đơn".
  - Đã tồn tại → báo trùng.
  - Dài hơn 30 ký tự → lỗi.
  - Chỉ `[A-Za-z0-9_./-]`.
  - Dạng `HD\d+` bị cấm (dành cho hệ thống), gợi ý `HDIP00001`.
- Thời gian (`:121-135`):
  - Trống → `now`.
  - Định dạng `d/M/yyyy [H:mm[:ss]]` giờ VN, STRICT.
  - Không được ở tương lai quá 5 phút.
  - Kiểm tra khóa sổ.
- Người bán: khớp tên đăng nhập, rồi họ tên, của user đang hoạt động (`GET /api/users/lookup`); trống → người import.
- Kênh bán: theo tên hoặc mã của kênh đang hoạt động; trống → `DIRECT`.
- Bảng giá: theo tên; trống hoặc "Bảng giá chung" → null.
- Khách (`:86-94`):
  - Có mã → tìm theo mã; không thì tìm theo SĐT (so chữ số `phone`/`phone2`, chọn khách tạo sớm nhất).
  - Không thấy mà có tên → tạo khách mới `PERSONAL` khi lưu HĐ đầu tiên. Khóa gộp = mã|SĐT|tên (`InvoiceImportService.java:84-95`).
  - Không thấy và không có tên → lỗi.
- Dòng hàng (`InvoiceImportLinePlanner.java`):
  - Mã hàng = mã đơn vị, hoặc mã vạch (mã đơn vị ưu tiên), của hàng bán trực tiếp ở danh mục `GET /api/products/sale-catalog?branchId=&withPriceBooks=true`.
  - SL > 0.
  - Đơn giá trống → giá bảng giá, không có thì giá đơn vị.
  - Giảm giá % (0–100) ưu tiên hơn số tiền; giảm > đơn giá → lỗi.
  - Hàng theo lô:
    - Bắt buộc có Lô, có tại chi nhánh, chưa hết hạn.
    - HSD nhập (nếu có) phải trùng HSD của lô.
    - Tồn của lô được cộng dồn qua cả file.
  - Hàng không theo lô: kiểm tra tồn cộng dồn, trừ khi bật `allowNegativeStock`.
  - Số đọc được cả `100,000`, `100.000`, `12,5` (`InvoiceImportCells.java:38-51`).
- Giảm giá HĐ: % (0–100) ưu tiên, hoặc số tiền ≥ 0; lớn hơn tổng hàng → lỗi.
- Thanh toán: cột Tiền mặt / Thẻ / Chuyển khoản, mỗi cột ≥ 0.
  - Tổng > khách cần trả → lỗi.
  - Khách lẻ trả thiếu → lỗi (`InvoiceImportPlanner.java:107-112`).
  - Thứ tự phương thức: Thẻ là phương thức chính (`TT{mã}`); Tiền mặt, rồi Chuyển khoản là khoản thêm (`-2`, `-3`) (`InvoiceImportService.java:97-114`).
- Lưu: từng HĐ qua đúng `InvoiceService.create(fixedCode, lots)`: trừ kho đúng lô, phiếu thu, công nợ; mỗi HĐ 1 transaction; `saleMode=QUICK`.
  - Lỗi giữa chừng → `failed` + danh sách các HĐ đã tạo trước đó (không rollback các HĐ đã lưu).

**Export** (`GET /api/invoices/export`; `InvoiceExportService.java`, `InvoiceExportRepository.java`; client `invoice-xlsx-export.ts`, `invoice-export-fields.ts`)
- Phạm vi: mọi HĐ khớp bộ lọc + ô tìm kiếm hiện tại (cùng tham số với GET list). Quá 5000 HĐ → `EXPORT_TOO_LARGE` "…hãy thu hẹp thời gian hoặc bộ lọc".
- `detail=true` thêm:
  - Tiền theo quỹ: Tiền mặt / Thẻ / Chuyển khoản / Ví. "Thẻ" = phiếu `INVOICE` quỹ BANK của HĐ có `payment_method=CARD`; quỹ BANK còn lại = Chuyển khoản.
  - Thông tin người nhận / kiện của vận đơn hiện hành; ghi chú trạng thái giao gần nhất.
  - Dòng hàng + số lô.
- File tổng quan: 1 dòng / HĐ, theo các cột đang hiển thị.
- File chi tiết: 1 dòng / dòng hàng, chọn cột theo nhóm (HĐ / thanh toán / khách / hàng / giao hàng / khác).
  - Client tra thêm: HĐĐT, chi nhánh, MST cửa hàng, nhóm hàng / mã vạch (`/products/{id}`), HSD lô; gọi theo lô 6 request song song.
- Tên file `DanhSachHoaDon_KV{ddMMyyyy-HHmmss-SSS}.xlsx`. Ô chữ bắt đầu bằng `= + - @` được thêm `'` để chặn công thức (`invoice-xlsx-export.ts:9-24`).
- Chạy nền; panel góc phải dưới hiện link tải (`invoice-file-jobs-panel.tsx`).
- Xuất 1 HĐ từ chi tiết: `exportOneInvoice` (`invoice-csv-export.ts`).

---

### 2.8 Trả hàng — route `/returns` + tab trả ở POS

**API** (`S/salesreturn/SalesReturnController.java`)

| Method + path | Quyền | Việc |
|---|---|---|
| `GET /api/sales-returns` | `sales.perform` | danh sách; size 1–100. Offset tính bằng `page × size` gửi lên, không theo size đã chặn (`SalesReturnManageService.java:34-38`) |
| `GET /api/sales-returns/export` | `sales.perform` | xuất file, tối đa 5000 phiếu |
| `GET /api/sales-returns/{id}` | `sales.perform` | chi tiết |
| `POST /api/sales-returns` | `sales.perform` | tạo |
| `POST /api/sales-returns/{id}/cancel` | `sales.cancel` | hủy |

**Trả theo HĐ** (`S/salesreturn/SalesReturnService.java:62-111`)
1. Id đã có → trả phiếu cũ (idempotent).
2. HĐ phải `COMPLETED`, ngược lại `INVOICE_NOT_RETURNABLE` "Hóa đơn đã hủy, không trả hàng được".
3. `checkBranch(chi nhánh HĐ)`; khóa sổ theo `returnedAt ?? now`.
4. Thiết lập `returnLimitDays` (null = không giới hạn): quá N ngày kể từ ngày bán → `RETURN_WINDOW_EXPIRED` (`SalesRules.java:61-68`).
5. Từng dòng:
   - `invoiceLineId` không thuộc HĐ → `LINE_NOT_FOUND`.
   - SL ≤ đã bán − đã trả (phiếu trả `COMPLETED`), ngược lại `RETURN_EXCEEDS_SOLD` "{tên}: chỉ còn trả được n".
   - `quantity ≥ 0.001`.
   - Giá trả = `unitPrice` gửi lên, null → đơn giá − giảm giá dòng của HĐ.
6. Chọn lô nhập lại (`:129-153`):
   - Lấy các lô đã xuất cho dòng trừ phần đã trả (`invoice_line_lots`).
   - Tỷ lệ = SL cơ bản đã xuất / SL dòng (scale 4). `need = SL trả × tỷ lệ` (scale 3).
   - Lấy lần lượt theo `lot_number` tăng dần.
   - Không có dữ liệu xuất kho → `LINE_LOTS_MISSING`; không đủ → `RETURN_EXCEEDS_SOLD` "vượt số lượng đã bán theo lô".
7. Tổng:
   - `subtotal = Σ round_half_up(SL × giá)`.
   - `discount = min(round(discount), subtotal)`.
   - `fee` (phí trả hàng) = `min(round(fee), subtotal − discount)`.
   - `total` (cần trả khách) = `subtotal − discount − fee`.
   - `refund = refundAmount == null ? total : min(round(refundAmount), total)`.
8. Khách lẻ: `refund ≥ total − (total HĐ − paid HĐ)`, ngược lại `WALK_IN_REFUND` "Khách lẻ: phải trả đủ tiền cho khách". Phần HĐ chưa thu (COD chuyển hoàn) được trừ ra.
9. Mã `TH…`; kho `SALE_RETURN` theo `(lotNumber, baseQuantity)`, docId = id phiếu.

**Trả nhanh** — không theo HĐ, `invoiceId=null` (`S/salesreturn/QuickReturnService.java`)
- Validate:
  - Thiếu `branchId` → `BRANCH_REQUIRED`; `checkBranch`; khóa sổ.
  - Khách không tồn tại → `CUSTOMER_NOT_FOUND`.
  - Dòng thiếu `productId` / `unitId` / `unitPrice` → `QUICK_RETURN_LINE_INVALID`.
  - Đơn vị không thuộc hàng hoặc tỷ lệ quy đổi ≤ 0 → `UNIT_NOT_FOUND`. Hàng tra qua `GET /api/products/{id}` bằng JWT người dùng.
  - Hàng theo lô thiếu lô → `LOT_REQUIRED`; hàng không theo lô thì bỏ qua lô.
- Không áp giới hạn số ngày trả.
- `baseQty = SL × tỷ lệ` (scale 3).
- Lô mới: gửi `expiryDate`. Kho báo `EXPIRY_REQUIRED` → thông báo lại "…chưa có tại chi nhánh — nhập hạn sử dụng để tạo lô mới".
- Tổng như trả theo HĐ. Khách lẻ phải hoàn đủ `refund = total`.
- Giá vốn dòng trả = `unitCost` cơ bản kho trả về × tỷ lệ (scale 4), lưu vào `sales_return_lines.cost` (`M/V13:13-14`).
- Client: chọn lô có sẵn (cả lô đã bán hết) hoặc nhập lô mới + HSD (`sale-quick-return-lot.tsx`). Kiểm tra trước: không có hàng, khách lẻ chưa hoàn đủ, thiếu lô, thiếu HSD (`use-sale-return-submit.ts:26-35`).

**Ghi phiếu** (1 transaction, `S/salesreturn/SalesReturnWriter.java:78-125`)
- `sales_returns` `status=COMPLETED`. `payment_method` = phương thức request (mặc định `CASH`) khi `refund > 0`, ngược lại null.
- Dòng: `lots` dạng `"LOT:qty"`; `sales_return_line_lots`.
- `refund > 0` → phiếu chi `PC{TH}`:
  - `PAYMENT`, category "Chi Tiền trả khách".
  - Quỹ: `TRANSFER`/`CARD` → `BANK`; `EWALLET` → `EWALLET`; còn lại `CASH`.
  - `accounting=false`, `source_type=RETURN`, không phân bổ.
  - Note "Trả hàng TH… / HD…" hoặc "Trả nhanh TH…".
- Khách có tài khoản:
  - Sổ nợ `RETURN −total` ("Trả hàng HD…" / "Trả nhanh") và `REFUND +refund` (mã `PC{TH}`). Phần chưa hoàn = giảm nợ.
  - `total_returns += total`.
- Phiếu trả KHÔNG thay đổi `invoices.paid` / `total`.
- Audit "Tạo", chỉ ghi khi phiếu thật sự mới.

**Hủy phiếu trả** (`SalesReturnService.java:113-123`, `SalesReturnWriter.java:127-145`)
- Đã hủy → return.
- `checkBranch`; khóa sổ theo `returned_at`.
- Kho `SALE_RETURN_CANCEL` (docId = id phiếu).
- Ghi DB:
  - `CANCELLED`; hủy `PC{TH}`.
  - Sổ nợ `RETURN_CANCEL +total` ("Hủy phiếu trả hàng") và `REFUND_CANCEL −refunded`.
  - `total_returns −= total`.
- Server không chặn hủy phiếu trả sinh từ chuyển hoàn vận đơn.

**Chuyển hoàn vận đơn** (`S/delivery/ShipmentReturnService.java`)
- Vận đơn "Đã chuyển hoàn" → tạo phiếu trả cho toàn bộ hàng còn lại của HĐ. Id phiếu = `UUID("shipment-return:" + shipmentId)`.
- `discount = min(discount HĐ, subtotal)`, `fee = 0`.
- Cách hoàn tiền bắt buộc chọn (`REFUND_METHOD_REQUIRED`):
  - `CASH`/`TRANSFER` → hoàn `min(paid HĐ, subtotal − discount)`.
  - `CREDIT` → không hoàn (cấm với khách lẻ: `WALK_IN_CREDIT`).
- Note "Chuyển hoàn vận đơn …".

**Danh sách** (`SalesReturnQueryRepository.java`, `F/app/(admin)/returns/page.tsx`, `F/features/returns/*`)
- Loại phiếu: `QUICK` (không có HĐ) / `SHIPMENT` (vận đơn có `return_id` = phiếu) / `INVOICE` (`:36-37`).
- Bộ lọc server: `q` (mã TH, mã HĐ, tên khách — ilike, không bỏ dấu), `statuses`, `from`/`to` theo `returned_at`, `invoiceId`, `types`, `deliveryStatuses` / `partnerId` (theo vận đơn bán). Sắp xếp `returned_at desc`. Tổng `sumTotal`.
- Server không có lọc theo chi nhánh.
- Mặc định client: tháng này, cả 3 loại, trạng thái `COMPLETED`. Bỏ hết loại → gửi `types=NONE` (không ra phiếu nào). Link sâu `?code=` = toàn thời gian, mọi trạng thái.
- Cột (`return-list-columns.tsx:30-34`):
  - Mặc định: người bán, thời gian, mã KH, khách, tổng tiền hàng, cần trả, đã trả, trạng thái, trạng thái giao.
  - Còn lại: mã HĐ, mã vận đơn bán, thời gian tạo, chi nhánh, người tạo, kênh, ghi chú, giảm giá, sau giảm giá, phí trả.
  - Lưu ở khóa `kv.returns.columns`.
- Xuất file: tổng quan / chi tiết (`return-xlsx-export.ts`).
- Nút "+ Trả hàng" → `/sale?returnPicker=1`.
- Chi tiết: nút Hủy cần `sales.cancel`, phiếu `COMPLETED` và `confirm()`.

---

### 2.9 Đặt hàng — route `/orders` (đang được cập nhật)

> Đang được cập nhật: agent khác đang sửa tính năng này trong lúc đọc. Các file backend `order/*` vừa đổi (≈01:25), chữ ký `cancel`/`detach` của HĐ vừa đổi trong lúc đọc. Một số endpoint mới ở backend chưa được frontend gọi. Nội dung dưới đây là trạng thái code tại thời điểm đọc.

**API** (`S/order/OrderController.java`; mức class `sales.perform` hoặc `report.view`)

| Method + path | Quyền | Việc |
|---|---|---|
| `GET /api/orders` | class | lọc `q, statuses, from, to, createdBy, customerId, branchId, productQ, customerQ, deliveryFrom/To, sellerId, channels, paymentMethods`; size 1–100 |
| `GET /api/orders/export` | class | tối đa 5000 đơn + dòng (chưa thấy frontend gọi) |
| `GET /api/orders/{id}` | class | chi tiết + phiếu cọc / hoàn cọc + "đã giao" |
| `POST /api/orders` | `sales.perform` | tạo (Phiếu tạm) |
| `PUT /api/orders/{id}` | `sales.perform` | sửa từ POS |
| `PATCH /api/orders/{id}/info` | `sales.perform` | sửa nhanh ở chi tiết (chưa thấy frontend gọi) |
| `POST /api/orders/{id}/confirm` | `sales.perform` | xác nhận |
| `POST /api/orders/{id}/finish` | `sales.perform` | "Kết thúc" (chưa thấy frontend gọi) |
| `POST /api/orders/{id}/cancel?refundMethod=&bankAccountId=` | `sales.cancel` | hủy |
| `POST /api/orders/{id}/invoice` | `sales.perform` | tạo HĐ từ đơn; POS hiện dùng `POST /api/invoices` kèm `orderId` |
| `GET /api/orders/sale-search` | `sales.perform` | "Xử lý đặt hàng": chỉ `DRAFT`/`CONFIRMED`; mặc định 10, tối đa 50 (`OrderSaleSearchService.java:19`) |
| `GET /api/reports/orders/products`, `GET /api/reports/orders/transactions` | `report.view` | báo cáo đặt hàng |

**Trạng thái** (`S/order/CustomerOrder.java:21-101`)
- `DRAFT` (Phiếu tạm) → `CONFIRMED` (Đã xác nhận) → `COMPLETED` (đã tạo HĐ / Kết thúc) | `CANCELLED`.
- "Mở" = `DRAFT` hoặc `CONFIRMED`; chỉ đơn mở mới sửa / xác nhận / hủy / kết thúc / tạo HĐ được.
- Đơn không mở → `ORDER_NOT_OPEN`:
  - Đơn `COMPLETED`: "…đã tạo hóa đơn — hủy hóa đơn trước nếu cần sửa / hủy đơn".
  - Đơn đã hủy: "…đã hủy".
- Hủy HĐ tạo từ đơn → đơn mở lại `CONFIRMED`.
- `PATCH /info` đặt được `DRAFT` hoặc `CONFIRMED` khi đơn đang mở (`OrderService.java:165-167`).

**Dữ liệu**
- `customer_orders`:
  - `customer_id` NOT NULL: đặt hàng bắt buộc có khách ("Đặt hàng phải chọn khách hàng").
  - `deposit` = Σ cọc còn hiệu lực − đã hoàn.
  - Cột khác: `invoice_id`, `invoicing_id`/`invoicing_at` (giữ chỗ), `price_book_*`, `sales_channel`, `expected_delivery_at` (`M/V7`, `M/V8`, `M/V9`).
- Dòng có `tax_code`; validate dòng giống HĐ.
- Đặt hàng KHÔNG trừ kho (`M/V7:2`).

**Tạo** (`OrderService.create` `:47-73`)
- Id đã có → trả đơn cũ.
- `checkBranch`; khóa sổ theo `now`; kênh; khách.
- Tổng = `InvoiceMath.totals`, không có giảm thuế.
- `ordered_at = now`. Người bán mặc định = người thao tác; kênh mặc định `DIRECT`.
- `paidNow = min(round(paidAmount), total − deposit)` → `receive`.

**Sửa** (`:75-99`)
- Đơn phải mở; khóa sổ theo `ordered_at`.
- Có cọc mà đổi khách → `ORDER_HAS_DEPOSIT`.
- Tổng mới < cọc → `ORDER_TOTAL_BELOW_DEPOSIT`.
- Thay toàn bộ dòng; khoản trả thêm → `receive`.
- Client: sửa phải có mạng; đơn mới offline thì xếp hàng.

**Xác nhận**: đơn mở + khóa sổ theo `ordered_at` → `CONFIRMED`.

**Thu cọc** (`OrderDepositLedger.receive` `:49-60`)
- Phiếu thu `TT{DH}[-n]`: `RECEIPT`, "Thu Tiền khách trả", quỹ theo phương thức, `accounting=false`, `affects_debt=true`, `source_type=ORDER`, không phân bổ.
- Sổ nợ `PAYMENT −amount` ("Đặt cọc đơn …") → nợ khách có thể âm.
- `deposit += amount`.

**Tạo HĐ từ đơn** (POS `?orderInvoice=` → tab SALE `fromOrder` → `POST /api/invoices` với `orderId`)
- Trước khi trừ kho `depositForInvoice` (`OrderDepositLedger.java:97-110`, `OrderDepositRepository.java:27-34`):
  - Đơn phải mở, cùng khách (`ORDER_CUSTOMER_MISMATCH`), cùng chi nhánh (`ORDER_BRANCH_MISMATCH`).
  - Giữ chỗ: `UPDATE … SET invoicing_id=?` nếu chưa có ai giữ, hoặc cùng HĐ, hoặc chỗ giữ cũ hơn 2 phút. Máy khác đang giữ → 409 `ORDER_BUSY` "Đơn … đang được lập hóa đơn ở máy khác".
- Khách chỉ trả phần `total − min(deposit, total)`.
- Trong transaction lưu HĐ, `attach` (`:117-132`):
  - Kiểm tra lại các điều kiện.
  - Phân bổ phần còn lại của từng phiếu cọc (cũ trước) vào HĐ, tối đa phần HĐ còn nợ → `invoices.paid` tăng.
  - Đơn `COMPLETED`, `invoice_id` = HĐ.
- Cọc lớn hơn tổng HĐ → phần dư nằm ở phiếu cọc chưa phân bổ (nợ khách vẫn âm).
- Client: tạo HĐ từ đơn bắt buộc có mạng.
- "Đã giao" từng dòng = min(SL đặt, Σ SL cùng hàng + đơn vị trên HĐ còn hiệu lực) (`OrderQuery.java:53-59`).

**Hủy đơn** (`OrderService.cancel` `:109-131`, `OrderManageService.java:89-100`)
- `refundMethod` hợp lệ: `CASH|TRANSFER|CARD|EWALLET|CREDIT|CANCEL_VOUCHERS`, ngược lại `REFUND_METHOD_INVALID`. null → xử lý như hoàn tiền mặt (quỹ `CASH`).
- Đơn có `invoice_id` → `ORDER_HAS_INVOICE` "Phiếu đặt hàng đã có hóa đơn, không thể hủy".
- Đơn phải mở; khóa sổ theo `now`.
- Cách xử lý cọc:

  | refundMethod | Xử lý |
  |---|---|
  | `CANCEL_VOUCHERS` | hủy mọi phiếu cọc `PAID`; sổ nợ `PAYMENT_CANCEL +amount` từng phiếu; `deposit` giảm tương ứng |
  | `CREDIT` | giữ cọc: phiếu thu giữ nguyên, nợ khách vẫn âm, đơn giữ số `deposit` |
  | `CASH`/`TRANSFER`/`CARD`/`EWALLET` | nếu `deposit > 0`: phiếu chi `PC{DH}` = toàn bộ cọc, "Chi Tiền trả khách", `bank_account_id` chỉ cho `TRANSFER`/`CARD`; sổ nợ `REFUND +deposit`; `deposit = 0` |

  Nguồn: `OrderDepositLedger.java:62-95`.
- Đơn → `CANCELLED`, `cancelled_at = now`. Audit ghi rõ cách xử lý cọc.
- Client (`F/features/orders/order-cancel-dialog.tsx`, `F/features/sales/refund-method-fields.tsx`): chỉ có `CASH` (mặc định), `TRANSFER` (chọn tài khoản), `CREDIT`. Chưa có `CANCEL_VOUCHERS`.

**Kết thúc** (`finish` `:133-140`): đơn mở + khóa sổ theo `now` → `COMPLETED`, không tạo HĐ, phiếu cọc giữ nguyên.

**Sửa thông tin** (`updateInfo` `:142-169`)
- Đơn không được `CANCELLED`; `checkBranch`; khóa sổ theo `ordered_at` cũ, và theo ngày mới nếu đổi.
- Sửa được: người nhận đặt (`sellerId`), kênh. `expected_delivery_at` và `note` luôn bị ghi đè.
- Đổi trạng thái chỉ khi đơn đang mở.
- Áp dụng được cả đơn `COMPLETED` cho các trường thông tin.

**Hủy HĐ có đơn** (`InvoiceWriter.java:154-156` → `OrderDepositLedger.detach` `:134-147`)
- Gỡ phân bổ cọc khỏi HĐ, `paid` HĐ giảm tương ứng.
- Đơn về `CONFIRMED`, bỏ `invoice_id`/`invoicing_id`.
- `cancelPayments=true` → `cancelReceipts` trên đơn.
- Kiểm tra hủy HĐ trừ phần cọc đã phân bổ khỏi điều kiện "phiếu thu nợ" (`InvoiceChangeGuard.java:106`).

**Danh sách / chi tiết** (`F/app/(admin)/orders/page.tsx`, `F/features/orders/*`)
- Lọc client: trạng thái (mặc định `DRAFT` + `CONFIRMED`), thời gian (mặc định tháng này), người tạo, ô tìm kiếm (debounce 300 ms). Link sâu `?code=` / `?id=` = toàn thời gian, mọi trạng thái.
- Sắp xếp `ordered_at desc`. Tổng Σ subtotal / total / deposit.
- Tìm `q`/`customerQ` dùng ilike, không bỏ dấu.
- Lọc `paymentMethods` theo quỹ phiếu cọc: `CASH`/`BANK`/`EWALLET`.
- Xuất CSV trang đang xem: mã, thời gian, mã KH, khách, tổng hàng, giảm giá, tổng, đã trả, trạng thái, mã HĐ.
- Chi tiết, khi đơn mở:
  - Tạo hóa đơn (`/sale?orderInvoice=`), Chỉnh sửa (`/sale?order=`): cần `sales.perform`.
  - Xác nhận: đơn `DRAFT`.
  - Hủy: cần `sales.cancel`.
  - Đơn đã hủy nhưng còn `deposit > 0` → hiển thị "giữ cọc làm công nợ".

---

### 2.10 In (mẫu hóa đơn / trả hàng)

- Có 7 loại mẫu in A5: `INVOICE`, `DELIVERY_INVOICE`, `SALES_RETURN`, `CASH_RECEIPT`, `CASH_PAYMENT`, `PURCHASE_RECEIPT`, `PURCHASE_RETURN` (`F/features/print/print-template-defaults.ts:4`). Chưa có mẫu in đơn đặt hàng.
- Cửa hàng có thể sửa mẫu; loại chưa sửa dùng mẫu mặc định (`print-data.ts:14-15`).
- Trường `{Ten_Truong}` được escape HTML; khối `{#Dong_Hang}…{/Dong_Hang}` lặp theo từng dòng; `{Logo}` chèn ảnh logo.
- Mẫu đã sửa được sanitize: bỏ script, iframe, `on*`, `javascript:` (`print-render.ts:1-38`).
- In qua iframe ẩn, không mở tab mới.
- Trường HĐ (`print-data.ts:39-53`):
  - `Con_No = total − paid`.
  - `Giam_Thue = max(0, subtotal − discount − total)`; `Phuong_Phap_Giam_Thue` ghi "(khấu trừ: 10% → 8%)" hoặc "(trực tiếp: …)".
  - Đơn thuốc: `Ma_Don_Thuoc`, `Bac_Si_Ke_Don`, `Co_So_Kham`, `Chan_Doan`, `Thong_Tin_Don_Thuoc`.
  - Số tiền bằng chữ: `Tong_Cong_Bang_Chu`.
- `DELIVERY_INVOICE` thêm người nhận, SĐT, địa chỉ giao, `Ma_Van_Don`, `Thu_Ho` (= `codAmount`).
- `SALES_RETURN`: `Phi_Tra_Hang`, `Can_Tra_Khach`, `Da_Tra_Khach`, `Can_Tra_Khach_Bang_Chu`.

---

### 2.11 Quyền & khóa sổ (tổng hợp)

**Quyền**

| Quyền | Phạm vi |
|---|---|
| `sales.perform` | mọi thao tác ghi: tạo/sửa HĐ, sửa info/thuế, import, trả hàng, đặt hàng, xác nhận, kết thúc, tạo HĐ từ đơn; xem trả hàng; tra cứu ở POS |
| `sales.cancel` | hủy HĐ, hủy phiếu trả, hủy đơn; gộp đơn (kèm `sales.perform`) |
| `report.view` | chỉ xem danh sách / chi tiết / xuất HĐ và đơn; báo cáo đặt hàng |
| `internal` | `/internal/invoices/{id}` |

Gateway không route `/internal/**`.

**Khóa sổ** (`BOOK_LOCKED`, `CL/settings/ShopSettings.java:57-66`)
- Áp cho chứng từ có ngày (giờ VN) ≤ ngày khóa của chi nhánh, khi thiết lập khóa sổ đang bật.
- Mốc ngày được xét theo từng thao tác:

  | Thao tác | Ngày xét |
  |---|---|
  | Tạo HĐ | `soldAt` |
  | Sửa / hủy HĐ, sửa info | `sold_at` (+ ngày mới khi đổi thời gian) |
  | Gộp đơn | từng HĐ gốc |
  | Trả hàng tạo / hủy | `returned_at` |
  | Đơn: tạo / hủy / kết thúc | `now` |
  | Đơn: sửa / xác nhận / sửa info | `ordered_at` |
  | Import | từng thời gian trong file |

**Thiết lập cửa hàng** (mặc định `Sales(false, true, false, null)`): `allowNegativeStock=false`, `blockEditPublishedEInvoice=true`, `lockTransactionTime=false`, `returnLimitDays=null`.

---

### 2.12 Điểm chưa có / giới hạn thấy trong code

- `GET /api/invoices`, `GET /api/sales-returns`, `GET /api/orders` không giới hạn theo chi nhánh của user ở server; chỉ lọc khi client gửi `branchId`. Danh sách HĐ ở client không gửi `branchId`.
- `PATCH /api/invoices/{id}/info` và `/tax-codes` không gọi `checkBranch`; `/tax-codes` không kiểm tra trạng thái, khóa sổ, HĐĐT.
- `/internal/invoices/{id}` (dữ liệu phát hành HĐĐT) không dùng `einvoice_*` nhập trên HĐ (§2.2).
- Gộp đơn không chuyển giảm thuế / cờ `tax_reduced` / đơn thuốc / HĐĐT buyer sang HĐ gộp (§2.6).
- Tính chất HĐĐT: chỉ phát hành HĐ gốc; lọc `ADJUST` / `REPLACE` luôn rỗng (`InvoiceFilterSql.java:74-81`).
- Trạng thái hiển thị HĐ ở client dùng ít trạng thái vận đơn hơn server (§2.5).
- Đơn thuốc chưa kết nối Hệ thống Đơn thuốc Quốc gia (`M/V19:1`).
- Hạn mức công nợ khách chỉ cảnh báo ở POS, server không chặn.
- Thanh toán nhiều phương thức chỉ có khi tạo HĐ mới; sửa HĐ giữ nguyên các phiếu thêm (`InvoiceExtraPayments.java:18-22`).
- Đặt hàng (đang được cập nhật): backend đã có `finish`, `PATCH info`, `export`, `CANCEL_VOUCHERS`, `cancelPayments` của hủy HĐ, nhưng chưa thấy frontend gọi. Không có mẫu in đơn đặt hàng. Danh sách đơn chỉ xuất CSV trang hiện tại.
- Tìm kiếm phiếu trả và đơn đặt hàng dùng `ilike`, không bỏ dấu (khác với HĐ).
- Mã HĐ có thể nhảy cóc khi thanh toán lỗi sau bước cấp mã (`InvoiceService.java:102`).
- Ô tìm "Theo mã hóa đơn" của HĐ: ☆ yêu thích và cấu hình cột chỉ lưu trên máy, chưa đồng bộ giữa các máy (`invoice-list-prefs.ts:5-8`).

**Câu hỏi chưa giải quyết**
- Agent kia có giữ nguyên quy tắc `refundMethod=null` → hoàn cọc tiền mặt khi hủy đơn không, và có thêm UI cho `CANCEL_VOUCHERS` / `finish` / `info` không?
- Có chủ ý để `/internal/invoices/{id}` bỏ qua `einvoice_*` của HĐ không?


---

## 3. Khách hàng, sổ quỹ, công nợ, giao hàng

Quy ước trích dẫn: `BE/` = `backend/sales-service/src/main/java/com/vaxclinic/sales/`, `MIG/` = `backend/sales-service/src/main/resources/db/migration/`, `FE/` = `frontend/src/`, `APP/` = `frontend/src/app/(admin)/`. Mọi tiền là `NUMERIC(18,0)` (đồng, không lẻ) trừ `customer_groups.discount_value NUMERIC(18,2)`.

Quy tắc dùng chung:
- **Khóa sổ** `BOOK_LOCKED`: chứng từ có ngày (giờ VN) ≤ ngày khóa của chi nhánh thì không được tạo / sửa / hủy (`backend/common-lib/.../settings/ShopSettings.java:58-65`). Chỉ áp dụng khi `BookLock.enabled` và chi nhánh có ngày khóa (`ShopSettings.java:44-46`).
- **Chi nhánh** `BRANCH_NOT_ALLOWED`: `branchId` null hoặc không thuộc JWT của người dùng thì bị chặn (`BE/common/Actor.java:19-23`).
- **Lịch sử thao tác** (audit) ghi SAU khi transaction nghiệp vụ commit, ở các lớp `*ManageService`.
- **Khóa dòng**: số dư sổ nợ khách và sổ nợ đối tác luôn ghi sau `SELECT … FOR UPDATE`, nên `balance_after` đi đúng thứ tự (`BE/customer/CustomerRepository.java:21-24`, `BE/delivery/PartnerLedgerRepository.java:22-25`).

---

### 3.1 Khách hàng (hồ sơ, mã KH)

**1. Mục đích / màn hình / API**
- Route `/customers` (`APP/customers/page.tsx`). Link sâu `?code=KH000001` lọc theo mã và mở chi tiết, hoặc `?id=<uuid>` (`APP/customers/page.tsx:23`). Chi tiết mở ngay dưới dòng, có 3 tab: Thông tin | Lịch sử bán/trả hàng | Nợ cần thu từ khách (`FE/features/sales/customer-detail-panel.tsx:18-43`).
- Quyền mức lớp: `patient.view` OR `sales.perform` (`BE/customer/CustomerController.java:32`).

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/api/customers` | lớp | lọc + phân trang; `size` kẹp 1..100, mặc định 15 (`CustomerController.java:41-53`) |
| GET | `/api/customers/groups` | lớp | API cũ: danh sách tên nhóm |
| GET | `/api/customers/{id}` | lớp | |
| POST | `/api/customers` | `patient.manage` OR `sales.perform` | 201 |
| PUT | `/api/customers/{id}` | `patient.manage` OR `sales.perform` | |
| GET | `/api/customers/{id}/debts` | lớp | sổ nợ (xem 3.3) |
| POST | `/api/customers/{id}/payments` | `sales.perform` OR `cashbook.manage` | thu nợ |
| POST | `/api/customers/{id}/discounts` | `cashbook.manage` | chiết khấu thanh toán |
| POST | `/api/customers/{id}/adjustments` | `cashbook.manage` | điều chỉnh nợ |

- Không có API xóa hay ngừng hoạt động khách. Cột `active` có, nhưng chỉ dùng để lọc danh sách (`where c.active`, `BE/customer/CustomerListRepository.java:31`).

**2. Dữ liệu**
- Bảng `customers` (`MIG/V1__init_sales_schema.sql:9-47`), các cột chính:
  - `code` UNIQUE varchar(30)
  - `name`, `phone`, `phone2`, `email`, `facebook`, `birthday`, `gender` (MALE/FEMALE), `address`, `province`, `ward`
  - `group_id` → `customer_groups`, và `group_name` (bản sao tên nhóm)
  - `customer_type` (PERSONAL/COMPANY)
  - Thông tin xuất hóa đơn: `buyer_name`, `company_name`, `tax_code`, `invoice_*`, `id_number`, `passport`, `bank_name`, `bank_account`
  - Số tổng hợp: `debt`, `total_sales`, `total_returns`
  - `branch_id`, `created_by(_name)`, `active`, `created_at`
- Mã ĐVHC 2 cấp: `province_code` 2 số, `ward_code` 5 số, cùng bản `invoice_*_code` (`MIG/V12__admin_unit_codes.sql:2`, `BE/customer/Customer.java:60-68`).
- **Mã KH**:
  - Để trống thì sinh `KH%06d` từ sequence `customer_code_seq` (`BE/customer/CustomerService.java:36-38`, `MIG/V1__init_sales_schema.sql:1`).
  - Nhập tay thì lưu dạng `toUpperCase()`. Kiểm tra trùng không phân biệt hoa thường, lỗi `CUSTOMER_CODE_EXISTS` 409 (`CustomerService.java:39-43`).
  - Khi sửa: để trống thì giữ mã cũ; đổi mã thì kiểm tra trùng với các khách khác (`CustomerService.java:55-61`).
- Index: `phone`, `lower(name)`, và GIN trigram unaccent trên tên để tìm không dấu (`MIG/V15__accent_insensitive_search.sql:12`).

**3. Quy tắc**
- Validation request (`BE/customer/CustomerDtos.java:20-40`):
  - `name` bắt buộc, ≤200 ký tự.
  - `phone` ≤20, `email` phải đúng định dạng (≤150), `gender` chỉ `MALE|FEMALE`, `customerType` chỉ `PERSONAL|COMPANY`, `taxCode` ≤20.
  - `provinceCode` / `wardCode` theo regex `AdminUnitCodes`.
- **Trường bắt buộc tùy chỉnh** (Thiết lập → Khách hàng): `phone`, `email`, `gender`, `birthday`, `address`, `facebook`, `group`. Thiếu trường thì lỗi `CUSTOMER_FIELD_REQUIRED` "Bắt buộc nhập: …" (`CustomerService.java:66-85`). Mặc định không bắt buộc trường nào (`ShopSettings.java:33`).
- Chuẩn hóa dữ liệu:
  - Chuỗi rỗng được lưu thành null; `name` được trim.
  - `customerType` khác `COMPANY` được lưu thành `PERSONAL` (`CustomerService.java:103-133`).
- Nhóm: ưu tiên `groupId`. Client cũ gửi `groupName` thì tìm nhóm theo tên, không phân biệt hoa thường. Không thấy nhóm thì lỗi `GROUP_NOT_FOUND` 400 (`CustomerService.java:92-101`).
- `debt`, `total_sales`, `total_returns` không sửa được qua API khách. Các số này thay đổi như sau:
  - `debt`: chỉ thay đổi qua `DebtLedger` (`BE/debt/DebtLedger.java:15`).
  - `total_sales`: +total khi tạo hóa đơn, −total khi hủy (`BE/invoice/InvoiceWriter.java:131-132,168-169`).
  - `total_returns`: ± qua phiếu trả hàng (`BE/salesreturn/SalesReturnWriter.java:123,143`).
- Audit: "Khách hàng / Tạo|Sửa" (`BE/customer/CustomerManageService.java:52-64`).
- Thiết lập `debtLimit` (cảnh báo nợ) được lưu ở identity-service (`backend/identity-service/.../SettingsController.java:128-131`), nhưng **không thấy** sales-service hay màn bán hàng đọc giá trị này.

**4. Danh sách — bộ lọc / cột / xuất**
- Ô tìm kiếm (debounce 300ms) khớp `code` / `phone` / `phone2` theo ILIKE và `name` không dấu (`CustomerListRepository.java:32-35`).
- Sidebar lọc (`FE/features/sales/customer-list-filter-sidebar.tsx:45-90`):
  - Nhóm (gửi `groupId`)
  - Ngày tạo: Toàn thời gian hoặc khoảng ngày (`createdFrom` ≤ x < `createdTo`)
  - Người tạo
  - Loại khách: Tất cả / Cá nhân / Công ty
  - Giới tính
- Cột: Mã | Tên | SĐT | Nợ hiện tại | Tổng bán | Tổng bán trừ trả hàng (`APP/customers/page.tsx:72-74`). Dòng tổng đầu bảng hiện `sumDebt`, `sumSales`, `sumNetSales`, tính trên toàn bộ kết quả lọc chứ không riêng trang hiện tại (`CustomerListRepository.java:63-64`).
- Sắp xếp `created_at desc`. Trang cố định 15 dòng, không có chọn cỡ trang (`APP/customers/page.tsx:19`).
- Danh sách trả thêm `groupDiscountType/Value` để POS tự điền giảm giá nhóm, kể cả khi offline (`CustomerDtos.java:64-68`).
- Màn danh sách khách **không có nút xuất file**. Chỉ tab công nợ có xuất CSV (3.3).

**5. Giới hạn**
- Không có xóa / ngừng hoạt động khách, không có gộp khách.
- Không có điểm tích lũy cho khách: `loyaltyPoints` chỉ là cờ trên hàng hóa (`FE/features/products/product-form-state.ts:34`).

---

### 3.2 Nhóm khách hàng

**1. Màn hình / API**
- Route `/customers/groups` (`APP/customers/groups/page.tsx`). Nút thêm / sửa / xóa chỉ hiện với `patient.manage` (`groups/page.tsx:31`).

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/customer-groups` | `patient.view` OR `sales.perform` |
| POST | `/api/customer-groups` | `patient.manage` |
| PUT | `/api/customer-groups/{id}` | `patient.manage` |
| DELETE | `/api/customer-groups/{id}` | `patient.manage` → `{unlinkedCustomers}` |

(`BE/customer/CustomerGroupController.java:26-60`)

**2. Dữ liệu**
- Bảng `customer_groups(id, name, discount_type PERCENT|AMOUNT mặc định PERCENT, discount_value ≥0 mặc định 0, note ≤500, created_at)`, có UNIQUE `lower(name)` (`MIG/V6__customer_groups.sql:3-11`).
- Migration V6 chuyển các `group_name` gõ tay cũ thành nhóm thật, gộp các tên trùng không phân biệt hoa thường (`V6__customer_groups.sql:18-27`).

**3. Quy tắc**
- `name` bắt buộc ≤100, được trim. Trùng tên (không phân biệt hoa thường) thì lỗi `GROUP_NAME_EXISTS` 409 (`BE/customer/CustomerGroupService.java:49-71`).
- Giảm giá: kiểu null thì lấy PERCENT, giá trị null thì lấy 0, giá trị âm bị chặn. Nếu PERCENT > 100 thì lỗi `GROUP_DISCOUNT_INVALID` (`CustomerGroupService.java:92-102`).
- Đổi tên nhóm: cập nhật luôn `customers.group_name` của các khách trong nhóm (`BE/customer/CustomerGroupMemberRepository.java:35-37`).
- Xóa nhóm: khách trong nhóm được đặt `group_id = group_name = null`, khách không bị xóa. API trả số khách bị bỏ nhóm (`CustomerGroupMemberRepository.java:39-42`). Nếu nhóm còn khách, FE hỏi xác nhận kèm số khách (`groups/page.tsx:41-43`).
- `customerCount` chỉ đếm khách `active` (`CustomerGroupMemberRepository.java:21-32`).
- Giảm giá nhóm được POS tự điền vào giảm giá hóa đơn (`BE/customer/CustomerGroup.java:15`). Nhãn hiển thị: "10%" hoặc số tiền; trống nếu giá trị = 0 (`FE/features/sales/customer-group-discount.ts:7-14`).

**4. Danh sách**
- Cột: Tên | Giảm giá | Số khách | Ghi chú. Sắp theo tên tăng dần. Không phân trang, không xuất file.

---

### 3.3 Công nợ khách hàng (sổ nợ, thanh toán nợ phân bổ, chiết khấu, điều chỉnh)

**1. Màn hình / API**
- Tab "Nợ cần thu từ khách" trong chi tiết khách (`FE/features/sales/customer-detail-debt-tab.tsx`), gồm:
  - Lọc theo loại giao dịch, Xuất CSV
  - Nút: Thanh toán, Điều chỉnh, Chiết khấu (2 nút sau chỉ hiện khi `can("cashbook.manage")`), Tạo QR (`customer-detail-debt-tab.tsx:59-68`)
- API: xem bảng 3.1 (`/debts`, `/payments`, `/discounts`, `/adjustments`).

**2. Dữ liệu**
- Bảng `customer_debt_ledger(id, customer_id, doc_type, doc_id, doc_code, amount, balance_after, note, occurred_at)` (`MIG/V1__init_sales_schema.sql:148-159`).
- **Quy ước dấu**: `amount > 0` làm tăng nợ, `< 0` làm giảm nợ. `customers.debt` = số dư sau dòng cuối (`BE/debt/DebtLedger.java:14-18,41-43`). `amount = 0` thì không ghi dòng (`DebtLedger.java:38-40`).
- Các loại `doc_type` (`DebtLedger.java:23`):

| doc_type | Dấu | Nguồn |
|---|---|---|
| SALE | +total (sửa HĐ: +chênh lệch) | tạo / sửa / gộp hóa đơn (`BE/invoice/InvoiceWriter.java:124`, `InvoiceEditWriter.java:129,140`) |
| SALE_CANCEL | −total | hủy hóa đơn (`InvoiceWriter.java:161`) |
| PAYMENT | −số tiền | thu lúc bán (code `TT{HĐ}`), phiếu thu thêm, thu nợ PT, thu hộ COD khi giao thành công (`InvoiceWriter.java:125-129`, `BE/debt/DebtService.java:88`, `BE/delivery/ShipmentStatusWriter.java:93-96`) |
| PAYMENT_CANCEL | +số tiền | hủy phiếu thu (`BE/cashbook/CashbookService.java:97-100`, `InvoiceWriter.java:162-166`) |
| ADJUST | newDebt − debt hiện tại | điều chỉnh |
| DISCOUNT | −số tiền | chiết khấu thanh toán |
| RETURN / RETURN_CANCEL | −total / +total | phiếu trả hàng (`BE/salesreturn/SalesReturnWriter.java:119,140`) |
| REFUND / REFUND_CANCEL | +đã hoàn / −đã hoàn | tiền chi trả khách (code `PC{TH}`), hủy đơn đặt hàng có cọc (`SalesReturnWriter.java:121,141`, `BE/order/OrderDepositLedger.java:73`) |

- **Mã chứng từ**:
  - Thu nợ: `PT%06d` (`receipt_voucher_seq`, dùng chung với phiếu thu tay)
  - Chiết khấu: `CKTT%06d` (`debt_discount_seq`)
  - Điều chỉnh: `DC%06d` (`debt_adjust_seq`)

  Nguồn: `DebtService.java:69,96,110`, `MIG/V1__init_sales_schema.sql:3-6`.
- Đọc sổ: mới nhất trước (`occurred_at desc, balance_after`), **tối đa 200 dòng** (`BE/customer/CustomerDebtRepository.java:26-28`).

**3. Quy tắc**
- **Thanh toán nợ** (`DebtService.pay`, `DebtService.java:63-90`):
  - Request: `branchId` bắt buộc, `amount ≥ 1` ("Số tiền phải lớn hơn 0"), `occurredAt` null thì lấy now (`DebtService.java:34-38,67`).
  - Kiểm tra chi nhánh và khóa sổ theo `occurredAt` (`DebtService.java:65,68`).
  - Phương thức → quỹ: `TRANSFER` / `CARD` vào `BANK`, `EWALLET` vào `EWALLET`, còn lại vào `CASH` (`DebtService.java:139-141`).
  - Tạo phiếu thu với:
    - category "Thu Tiền khách trả", `partnerType = CUSTOMER`, `sourceType = DEBT`, `sourceId = customerId`
    - `accounting = false`, `affectsDebt = true`
    - người thu: mặc định là người thao tác (`DebtService.java:70-86`)
  - Ghi sổ nợ PAYMENT −amount (`DebtService.java:88`).
- **Thứ tự phân bổ** khi `allocate = true`:
  - Có `allocations` thì dùng đúng danh sách được chỉ định.
  - Không có thì tự phân bổ: lấy các hóa đơn `COMPLETED` có `paid < total` của khách, **cũ trước** (`sold_at asc`). Mỗi hóa đơn nhận `min(còn lại, total − paid)` cho tới khi hết tiền (`DebtService.java:116-132`, `BE/invoice/InvoiceRepository.java:24-26`).
  - Phần không phân bổ hết vẫn giảm nợ khách, chỉ không gắn vào hóa đơn nào.
  - FE dùng cùng thuật toán (cũ trước, tối đa 100 hóa đơn) và cho sửa tay từng dòng, kẹp ≤ còn nợ (`FE/features/sales/debt-dialogs.tsx:54-71`, `customer-debt-allocation-table.tsx:34-35`).
  - FE chặn nút lưu khi `allocated > amount` hoặc `amount ≤ 0` (`debt-dialogs.tsx:94`).
- **Kiểm tra phân bổ ở server** (`BE/cashbook/CashbookWriter.java:35-58`):
  - Σ phân bổ > tiền phiếu: lỗi `ALLOCATION_EXCEEDS`.
  - Hóa đơn không tồn tại: lỗi `INVOICE_NOT_FOUND`.
  - Hóa đơn không `COMPLETED`, hoặc `paid + a > total`: lỗi `ALLOCATION_INVALID` "Hóa đơn … không cần thu số tiền này".
  - Dòng phân bổ ≤0 được bỏ qua.
  - Khi hợp lệ: `invoices.paid += a` và ghi `voucher_allocations` (PK `voucher_id, invoice_id`).
- **Chiết khấu thanh toán** (`DebtService.java:92-105`):
  - Giảm nợ mà không thu tiền; không tạo phiếu Sổ quỹ.
  - `allocate = true` thì cộng thẳng `invoices.paid`. Không ghi `voucher_allocations`, và **không** kiểm tra trạng thái hóa đơn / vượt tổng / Σ ≤ amount.
  - **Không** kiểm tra chi nhánh và khóa sổ (khác với thu nợ).
- **Điều chỉnh nợ** (`DebtService.java:107-114`):
  - Đặt dư nợ về `newDebt`, ghi phần chênh lệch; không phát sinh tiền. `newDebt` bắt buộc, có thể âm.
  - Khóa dòng khách; **không** kiểm tra khóa sổ và chi nhánh. Audit ghi với branch null (`CustomerManageService.java:84-88`).
- **Hủy phiếu thu nợ**: thực hiện ở Sổ quỹ (3.4). Phiếu `affectsDebt`, `partnerType = CUSTOMER` thì ghi PAYMENT_CANCEL `+amount` (với phiếu chi là `−amount`), đồng thời trả lại `paid` cho các hóa đơn đã phân bổ (`CashbookService.java:97-100`, `CashbookWriter.java:60-71`).
- **Không có API hủy** cho chiết khấu (CKTT) và điều chỉnh (DC).
- Audit: "Phiếu thu / Thu nợ", "Khách hàng / Chiết khấu", "Khách hàng / Điều chỉnh nợ" (`CustomerManageService.java:70-89`). In phiếu: nút "Tạo và in" chỉ có ở hộp thoại thanh toán (`debt-dialogs.tsx:149-150`).
- QR thu nợ:
  - Số tiền = `max(debt, 0)`, nội dung = `{mã KH} thanh toan no` (`customer-detail-debt-tab.tsx:71`).
  - Nội dung chuyển khoản được bỏ dấu, chỉ giữ `[A-Za-z0-9 ]`, cắt ≤25 ký tự (`BE/cashbook/VietQrPayload.java:41-49`).

**4. Bộ lọc / xuất**
- Lọc loại giao dịch phía client. Dropdown chỉ có SALE, SALE_CANCEL, PAYMENT, PAYMENT_CANCEL, ADJUST, DISCOUNT (`FE/features/sales/sales-types.ts:40-43`).
- CSV `cong-no-{mã}.csv`, UTF-8 có BOM, tiêu đề luôn tiếng Việt: Mã phiếu | Thời gian | Loại | Giá trị | Dư nợ khách hàng | Ghi chú (`customer-detail-debt-tab.tsx:34-35`, `customer-csv-export.tsx:12-21`).

**5. Giới hạn**
- Sổ nợ chỉ hiện 200 dòng mới nhất.
- `DEBT_TYPE_LABEL` thiếu RETURN / REFUND / *_CANCEL: các dòng loại này vẫn hiển thị nhưng không lọc được, và CSV in mã thô.
- FE thu nợ không gửi `bankAccountId` (`debt-dialogs.tsx:78-82`), nên phiếu TRANSFER không gắn tài khoản.

---

### 3.4 Sổ quỹ (phiếu thu / chi, quỹ, hạch toán, loại thu chi)

**1. Màn hình / API**
- Route `/cashbook` (`APP/cashbook/page.tsx`). Tiêu đề theo quỹ đang chọn.
- Link sâu `?code=PT000001` (hoặc `?id`) thì tự đặt: quỹ = ALL, thời gian không giới hạn, trạng thái gồm cả đã hủy (`cashbook/page.tsx:22-35`).

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/cashbook` | `cashbook.manage` OR `report.view`; `fund` mặc định CASH; `size` 1..100 |
| GET | `/api/cashbook/categories` | không có `@PreAuthorize` riêng |
| GET | `/api/cashbook/{id}` | không có `@PreAuthorize` riêng; trả `{voucher, allocations}` |
| POST | `/api/cashbook` | `cashbook.manage` (201) |
| POST | `/api/cashbook/{id}/cancel` | `cashbook.manage` |
| POST | `/internal/cashflows` | `internal` (outbox product-service) |

(`BE/cashbook/CashbookController.java:39-116`)

**2. Dữ liệu**
- Bảng `cash_vouchers` (`MIG/V1__init_sales_schema.sql:108-133`):
  - `code` UNIQUE varchar(40), `voucher_type` RECEIPT/PAYMENT
  - `fund` CASH/BANK/EWALLET, `bank_account_id`
  - `category` (loại thu chi, text tự do), `amount > 0` (CHECK), `occurred_at`, `branch_id`
  - `partner_type`, `partner_id/name/phone`
  - `collector_*`, `created_by*`
  - `accounting` (mặc định true), `affects_debt` (mặc định false)
  - `status` PAID/CANCELLED, `source_type` (mặc định MANUAL), `source_id`, `note`
- **Dấu**: `amount` luôn dương; chiều tiền do `voucher_type` quyết định (`BE/cashbook/CashVoucher.java:16`).
- `partner_type` gồm CUSTOMER / SUPPLIER / EMPLOYEE / OTHER, và `DELIVERY_PARTNER` (do đối soát sinh ra, `BE/delivery/DeliverySettlementService.java:126`).
- `source_type` thấy trong code: MANUAL, INVOICE, INVOICE_EXTRA, DEBT, PURCHASE, RETURN, ORDER, DELIVERY (`CashbookService.java:87-88`).
- Unique một phần `uq_cash_vouchers_source(source_type, source_id) WHERE source_type IN ('INVOICE','PURCHASE')` (`MIG/V1__init_sales_schema.sql:136-137`).
- Bảng `voucher_allocations(voucher_id, invoice_id, amount)` (`V1:140-146`).
- **Mã phiếu**:

| Loại | Mã |
|---|---|
| Phiếu thu tay / thu nợ | `PT%06d` |
| Phiếu chi tay | `PC%06d` (`receipt_voucher_seq` / `payment_voucher_seq`, `CashbookService.java:64`) |
| Phiếu tự sinh | tiền tố + mã gốc: `TT{HĐ}`, `TT{HĐ}-2…`, `PC{PN}`, `PT{DS}` / `PC{DS}`… |

  FE suy ra mã gốc bằng regex `^(PC|PT|TT)(THN|PN|TH|HD|DH|DS)\d+` (`FE/features/sales/cash-voucher-detail.tsx:31-32`).

**3. Quy tắc**
- **Tạo phiếu tay** (`BE/cashbook/CashbookService.java:52-80`):
  - Bắt buộc: `voucherType`, `fund`, `category` ("Chọn loại thu chi"), `amount ≥ 1`, `branchId`. `partnerType` thuộc `CUSTOMER|SUPPLIER|EMPLOYEE|OTHER`, null thì lấy OTHER.
  - `partnerType = SUPPLIER` bị chặn với lỗi `SUPPLIER_VOUCHER_VIA_SUPPLIER_SCREEN`: thanh toán NCC phải làm ở Mua hàng → Nhà cung cấp để công nợ NCC khớp (`CashbookService.java:54-60`).
  - Kiểm tra chi nhánh và khóa sổ theo `occurredAt` (null thì lấy now).
  - Người thu/chi: mặc định là người thao tác. `accounting` theo checkbox (FE mặc định bật). `affects_debt` luôn false.
  - Hệ quả: phiếu thu tay gắn khách **không** làm thay đổi công nợ khách.
- **Hạch toán** (`accounting`): phiếu được tính vào kết quả kinh doanh.
  - Các phiếu tự động đều `accounting = false`: thu khi bán (`InvoiceWriter.java:112`), thu nợ (`DebtService.java:82`), outbox NCC (`CashbookService.java:139`), đối soát giao hàng (`DeliverySettlementService.java:134`).
  - Sổ doanh thu lấy "chi phí khác" từ: phiếu chi PAID có `accounting`, trừ phiếu NCC và nguồn RETURN/PURCHASE (`BE/accounting/RevenueBookRepository.java:72-80`).
- **Hủy phiếu** (`CashbookService.java:82-101`):
  - Nguồn INVOICE, INVOICE_EXTRA, PURCHASE, RETURN, ORDER, DELIVERY bị chặn với lỗi `VOUCHER_AUTO`: phải hủy từ chứng từ gốc.
  - Phiếu đã hủy thì không làm gì; audit vẫn ghi (`CashbookManageService.java:55-60`).
  - Kiểm tra khóa sổ theo `occurred_at` của phiếu. Chuyển `status = CANCELLED`, trừ lại `invoices.paid` theo các dòng phân bổ, và đảo công nợ khách nếu `affectsDebt`.
  - Không có sửa phiếu; chỉ có hủy.
- **Nhận phiếu từ service khác** `/internal/cashflows` (`CashbookService.java:103-145`), idempotent:
  - `CANCEL`: hủy nếu có phiếu.
  - `UPDATE`: chỉ đổi `occurredAt`, người thu, `note` của phiếu chưa hủy.
  - `CREATE`: nếu đã có phiếu cùng (source_type, source_id) thì bỏ qua. Hai lần gửi song song: bản sau vi phạm unique, bị rollback, rồi outbox gửi lại.
- **Số tổng** (`BE/cashbook/CashbookRepository.java:14-17,72-90`):
  - Quỹ đầu kỳ = Σ(thu − chi) các phiếu **PAID** có `occurred_at < from`, cùng quỹ và chi nhánh (`from` null thì bằng 0).
  - Tổng thu / Tổng chi = Σ phiếu PAID trong bộ lọc.
  - Tồn quỹ = đầu kỳ + thu − chi.
  - Quỹ đầu kỳ **chỉ** lọc theo quỹ và chi nhánh, không theo các bộ lọc khác.
- `fund = ALL` (hoặc null) thì không lọc quỹ.
- Loại thu chi: danh sách là `distinct category` từ các phiếu đã có (`CashbookRepository.java:103-105`). Khi tạo, ô loại thu chi là input + datalist, gõ tự do (`FE/features/sales/cash-voucher-dialog.tsx:81-84`). Không có bảng danh mục loại thu chi.

**4. Danh sách — bộ lọc / cột / xuất**
- Sidebar (`FE/features/sales/cash-voucher-filter-sidebar.tsx:25-70`):
  - Quỹ: Tiền mặt / Ngân hàng / Ví / Tổng quỹ
  - Thời gian: mặc định tháng này
  - Loại chứng từ: Thu / Chi
  - Loại thu chi
  - Trạng thái: mặc định chỉ PAID
  - Hạch toán: Tất cả / Có / Không
  - Người tạo, Nhân viên (collector)
  - Người nộp/nhận: loại (gồm `DELIVERY_PARTNER`) + ô text khớp tên hoặc SĐT (ILIKE)
- Ô tìm kiếm khớp mã phiếu (ILIKE).
- 4 thẻ tổng: Quỹ đầu kỳ | Tổng thu | Tổng chi (hiển thị âm) | Tồn quỹ.
- Cột: Mã phiếu | Thời gian | Loại thu chi | Người nộp/nhận | Giá trị (phiếu chi hiển thị âm). Phiếu hủy hiển thị gạch ngang. Sắp `occurred_at desc`. Có pager chọn cỡ trang (`APP/cashbook/page.tsx:56-103`).
- Xuất CSV `so-quy`: Mã phiếu | Thời gian | Loại thu chi | Người nộp/nhận | Giá trị (có dấu) | Trạng thái. Luôn tiếng Việt và **chỉ gồm các dòng của trang đang hiển thị** (`cashbook/page.tsx:57-58`).
- Chi tiết phiếu:
  - Hiển thị phiếu, các hóa đơn được phân bổ (theo `sold_at`), và mã chứng từ gốc dạng link.
  - Có nút hủy (khi phiếu không tự động) và nút in (CASH_RECEIPT / CASH_PAYMENT) (`cash-voucher-detail.tsx:51-103`).

**5. Giới hạn**
- FE coi là phiếu tự động chỉ khi nguồn là INVOICE / PURCHASE / DELIVERY (`cash-voucher-detail.tsx:51`). Với RETURN, ORDER, INVOICE_EXTRA, FE vẫn hiện nút Hủy, và backend sẽ trả `VOUCHER_AUTO`.
- Hộp thoại tạo phiếu chỉ chọn tài khoản khi quỹ là BANK. Với EWALLET không chọn được ví (`cash-voucher-dialog.tsx:50,75-80`).
- Unique theo nguồn chỉ áp cho INVOICE / PURCHASE. Với các nguồn khác, chống trùng chỉ dựa vào `findBySourceTypeAndSourceId`.

---

### 3.5 Tài khoản ngân hàng / ví điện tử (quỹ Ngân hàng / Ví), VietQR

**1. Màn hình / API**
- Thiết lập → Sổ quỹ, route `/settings/bank-accounts`, có 2 tab Ngân hàng | Ví điện tử (`APP/settings/bank-accounts/page.tsx:56-89`).

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/bank-accounts?kind=BANK\|EWALLET\|ALL` (mặc định BANK) | không riêng |
| POST | `/api/bank-accounts` | `cashbook.manage` |
| PUT | `/api/bank-accounts/{id}` | `cashbook.manage` |
| POST | `/api/bank-accounts/{id}/deactivate` | `cashbook.manage` |
| GET | `/api/bank-accounts/{id}/vietqr?amount=&info=` | không riêng |

**2. Dữ liệu**
- Bảng `bank_accounts(id, bank_name, bank_bin ≤10, account_no, account_name, active, kind BANK|EWALLET mặc định BANK, note ≤300)` (`MIG/V1__init_sales_schema.sql:98-105`, `MIG/V5__ewallet_accounts.sql`).

**3. Quy tắc**
- Bắt buộc: `bankName`, `accountNo`, `accountName`. `kind` null thì lấy BANK.
- Chuẩn hóa: `accountName` được trim và **viết hoa**. Với ví (`EWALLET`), `bankBin` luôn bị xóa về null (`BE/cashbook/BankAccountService.java:75-82`). Với ví, `bankName` là tên ví và `accountNo` là SĐT / mã ví.
- Danh sách chỉ gồm tài khoản đang dùng, sắp theo `bank_name`.
- "Xóa" ở UI là ngừng dùng (`active = false`). Id không tồn tại thì bỏ qua, không báo lỗi (`BankAccountService.java:62-68`).
- VietQR (`BE/cashbook/VietQrPayload.java`):
  - Thiếu BIN: lỗi `BANK_BIN_MISSING`.
  - Cấu trúc payload: EMVCo, GUID NAPAS `A000000727`, dịch vụ `QRIBFTTA`, tiền tệ 704, quốc gia VN, CRC-16/CCITT-FALSE.
  - `amount > 0` thì tạo mã động (12) có số tiền; ngược lại mã tĩnh (11). `amount` âm được kẹp về 0 (`BankAccountService.java:58`).
- FE báo "thiếu BIN" trên dòng tài khoản ngân hàng chưa có BIN. Nút "Thử QR" dùng 10.000đ (`bank-accounts/page.tsx:41,87`).

**5. Giới hạn**
- Phạm vi tài khoản luôn hiển thị "Tất cả chi nhánh"; không có gán tài khoản theo chi nhánh (`bank-accounts/page.tsx:42`).

---

### 3.6 Kênh bán

**1. Màn hình / API**
- Thiết lập → Đơn hàng → Kênh bán (`FE/features/settings/sales-channel-settings.tsx`, dùng ở `APP/settings/orders/page.tsx`).

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/sales-channels?all=false` | `sales.perform` OR `report.view` OR `settings.manage` |
| POST | `/api/sales-channels` | `settings.manage` (201) |
| PUT | `/api/sales-channels/{code}` | `settings.manage` |
| DELETE | `/api/sales-channels/{code}` | `settings.manage` (204) |

(`BE/channel/SalesChannelController.java:24-59`)

**2. Dữ liệu**
- Bảng `sales_channels(code PK, name, active, builtin, sort_order, created_at)`, UNIQUE `lower(name)` (`MIG/V9__sales_channels_and_doc_metadata.sql:5-13`).
- Seed: `DIRECT` "Bán trực tiếp" (builtin, sort 0), `FACEBOOK` 1, `ZALO` 2, `WEBSITE` 3, `PHONE` 4 (`V9:14-19`).
- `invoices.sales_channel` và `customer_orders.sales_channel`: NOT NULL, mặc định `DIRECT`, FK tới `sales_channels` (`V9:21-31`).
- Mã kênh mới sinh dạng `CH%03d` từ `sales_channel_code_seq` (`BE/channel/SalesChannelService.java:38`).

**3. Quy tắc**
- `name` bắt buộc, ≤100 ký tự. Trùng tên (không phân biệt hoa thường) thì lỗi `CHANNEL_NAME_DUPLICATE` 409.
- Mặc định khi tạo: `active = true`, `sortOrder = 10`. Khi sửa, giá trị null giữ nguyên giá trị cũ (`SalesChannelService.java:36-63`).
- Kênh builtin không ngừng được và không xóa được: lỗi `CHANNEL_BUILTIN` (`SalesChannelService.java:52-54,69-71`).
- Xóa: kênh đã có hóa đơn hoặc đơn đặt hàng thì lỗi `CHANNEL_IN_USE` 409 "đã có N giao dịch, hãy chuyển sang ngừng hoạt động" (`SalesChannelService.java:72-75`).
- Khi lưu hóa đơn / đơn hàng (`BE/channel/SalesChannels.java:28-42`):
  - Mã trống thì lấy `DIRECT`.
  - Mã phải là kênh đang hoạt động, nếu không thì lỗi `CHANNEL_NOT_FOUND`.
  - Ngoại lệ: được giữ nguyên kênh cũ của chứng từ dù kênh đó đã ngừng hoạt động.
- Danh sách sắp theo `sort_order, name`. `all = false` chỉ trả kênh active.
- Audit "Kênh bán / Tạo|Sửa|Xóa".
- FE:
  - Sửa tên khi rời ô (onBlur) và chỉ khi tên thực sự thay đổi.
  - Công tắc Hoạt động và nút xóa bị khóa với kênh builtin, hoặc khi người dùng không có `settings.manage` (`sales-channel-settings.tsx:46-55`).

---

### 3.7 Vận đơn (shipments)

**1. Màn hình / API**
- Route `/delivery/shipments` (`APP/delivery/shipments/page.tsx`).
  - Link sâu `?code=VD…` mở chi tiết với thời gian = mọi thời gian.
  - Query `?statuses=A,B&partnerId=&connection=&createdFrom=&createdTo=` được mở từ Quản lý giao hàng (`shipments/page.tsx:26-35`).
- Vận đơn hiển thị kèm hóa đơn (`FE/features/delivery/invoice-shipment-info.tsx`, `invoice-shipment-bar.tsx`). "Tạo vận đơn" có ở `shipment-create-dialog.tsx`.
- Quyền mức lớp: `sales.perform` OR `report.view` (`BE/delivery/ShipmentController.java:36`).

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| POST | `/api/shipments` | `sales.perform` | "Tạo vận đơn" cho HĐ đã bán (201) |
| GET | `/api/shipments` | lớp | lọc, `size` 1..200 (`ShipmentManageService.java:62`) |
| GET | `/api/shipments/dashboard?from&to&partnerId&connection` | lớp | 3.10 |
| GET | `/api/shipments/cashflow?from&to&partnerId&connection` | lớp | 3.10 |
| GET | `/api/shipments/receiver-stats?phone=` | lớp | % giao thành công theo SĐT |
| GET | `/api/shipments/{id}` | lớp | chi tiết + lịch sử |
| PUT | `/api/shipments/{id}` | `sales.perform` | sửa thông tin giao |
| POST | `/api/shipments/status` | `sales.perform` | đổi trạng thái 1 hoặc nhiều vận đơn |

- Mọi đọc / ghi đều giới hạn trong các chi nhánh người dùng được làm việc (`ShipmentManageService.java:98-102`).
- Hủy vận đơn chỉ cần `sales.perform`, vì hóa đơn vẫn giữ nguyên (`ShipmentController.java:29-33`).

**2. Dữ liệu**
- Bảng `shipments` (`MIG/V10__delivery.sql:24-49`, cùng V11, V12, V16, V18), các cột chính:
  - `code` UNIQUE (`VD%06d`, `shipment_code_seq`, `ShipmentInvoiceHooks.java:61`), `invoice_id`, `branch_id`, `partner_id`
  - Người nhận: `receiver_name/phone/address` (bắt buộc), `area`, `province_code`, `ward_code`
  - Kiện hàng: `weight_gram ≥0`, `package_count ≥1` (mặc định 1), `length/width/height_cm ≥0`
  - Phí và thu hộ: `shipping_fee ≥0`, `fee_payer` SHOP|CUSTOMER (mặc định SHOP), `cod_amount ≥0`, `cod_enabled` (mặc định true), `cod_posted`, `fee_posted`, `return_fee ≥0` (mặc định 0)
  - Dịch vụ: `service_type` STANDARD|EXPRESS|SAME_DAY (mặc định STANDARD), `waybill_code` (mã của đối tác), `expected_delivery_at`
  - `status`, `return_id`, `settlement_id`, `delivered_at`, `created_by*`, `created_at`, `updated_at`
- `cod_posted` / `fee_posted` = số đã ghi vào sổ đối tác (NULL nghĩa là chưa ghi). Đối soát dùng đúng các số đã ghi này (`V10:21-23`).
- Từ V11: một hóa đơn có thể có nhiều vận đơn, nhưng **chỉ 1 vận đơn chưa hủy** tại một thời điểm: `ux_shipments_active_invoice … WHERE status <> 'CANCELLED'` (`MIG/V11__shipment_cancel_and_return_fees.sql:1-13`).
- Bảng `shipment_status_logs(from_status, to_status, note ≤500, changed_by, changed_by_name, changed_at)` (`V10:53-63`).
- **Dịch vụ**: STANDARD = Giao thường, EXPRESS = Giao nhanh, SAME_DAY = Giao trong ngày (`BE/delivery/ShipmentDtos.java:46-47`).
- **TL quy đổi** (chỉ tính ở FE): `round(Dài × Rộng × Cao / 6)` gam, tương đương `/6000` kg; thiếu 1 kích thước thì bằng 0 (`FE/features/delivery/shipment-detail-info.tsx:17-19`).
- Tiền phí được làm tròn `setScale(0, HALF_UP)`; null thì bằng 0 (`ShipmentInvoiceHooks.java:145-147`).

**3. Quy tắc**
- **Tạo cùng hóa đơn "Bán giao hàng"** (`BE/delivery/ShipmentInvoiceHooks.java:38-66`):
  - Kiểm tra trước khi xuất kho:
    - Chế độ DELIVERY mà thiếu thông tin giao: lỗi `DELIVERY_REQUIRED`.
    - Có thông tin giao nhưng không phải chế độ DELIVERY: lỗi `DELIVERY_MODE`.
    - Đối tác không tồn tại hoặc đã ngừng: lỗi `PARTNER_NOT_FOUND`.
  - Vận đơn luôn tạo ở `PENDING`, ghi log "Tạo vận đơn từ hóa đơn …".
  - Được tạo **sau** phiếu thu và tiền cọc, nên thu hộ = tổng − đã trả (`InvoiceWriter.java:121`).
- **Thu hộ (COD)** = `max(total − paid, 0)` nếu `codEnabled` (mặc định bật). Tắt thì bằng 0 và phần khách chưa trả nằm ở công nợ khách (`ShipmentInvoiceHooks.java:127-134`, `ShipmentDtos.java:40-43`).
- **Trạng thái ban đầu** chọn ở POS: chỉ `PENDING|PICKING|DELIVERING|DELIVERED` (`ShipmentDtos.java:48-49`).
  - Sau khi lưu hóa đơn, hệ thống chuyển vận đơn sang trạng thái đã chọn qua luồng đổi trạng thái thường, với note "Trạng thái chọn khi bán hàng".
  - Lỗi (ví dụ khóa sổ) thì chỉ ghi log warn: vận đơn giữ PENDING, hóa đơn vẫn lưu (`BE/delivery/ShipmentInitialStatus.java:14-47`).
- **Validation đầu vào** (`ShipmentDtos.java:27-38`):
  - `partnerId` bắt buộc ("Chưa chọn đối tác giao hàng"). Tên, SĐT, địa chỉ người nhận bắt buộc (≤200 / 20 / 300).
  - `area` ≤150, `note` ≤1000, `waybillCode` ≤50, `packageCount ≥1`, các kích thước và trọng lượng ≥0, `shippingFee ≥0`.
- **Trạng thái và bước chuyển** (`BE/delivery/ShipmentStatus.java:37-46`; FE có bản sao ở `delivery-types.ts:104-112`):

| Từ | Được chuyển sang |
|---|---|
| PENDING (Chờ xử lý) | PICKING, PICKED, DELIVERING, DELIVERED, CANCELLED |
| PICKING (Đang lấy hàng) | PICKED, WAIT_REPICK, DELIVERING, DELIVERED, CANCELLED |
| WAIT_REPICK (Chờ lấy lại) | PICKING, PICKED, CANCELLED |
| PICKED (Đã lấy hàng) | DELIVERING, DELIVERED |
| DELIVERING (Đang giao hàng) | DELIVERED, WAIT_REDELIVER, WAIT_RETURN, RETURNING, RETURNED |
| WAIT_REDELIVER (Chờ giao lại) | DELIVERING, DELIVERED, WAIT_RETURN, RETURNING, RETURNED |
| WAIT_RETURN (Chờ chuyển hoàn) | DELIVERING, RETURNING, RETURNED |
| RETURNING (Đang chuyển hoàn) | WAIT_RERETURN, RETURNED |
| WAIT_RERETURN (Chờ chuyển hoàn lại) | RETURNING, RETURNED |
| DELIVERED / RETURNED / CANCELLED | — (trạng thái cuối) |

- **"Chưa lấy hàng"** = PENDING / PICKING / WAIT_REPICK. Chỉ khi chưa lấy hàng mới được sửa thông tin giao, sửa / hủy hóa đơn, hoặc hủy vận đơn (`ShipmentStatus.java:72-75`).
- **Đổi trạng thái** (`BE/delivery/ShipmentStatusService.java:58-86`):
  - Vận đơn không tồn tại: lỗi `SHIPMENT_NOT_FOUND`. Kiểm tra chi nhánh.
  - Trạng thái đích trùng trạng thái hiện tại: trả ok, không ghi gì.
  - Bước chuyển sai: lỗi `SHIPMENT_STATUS_INVALID`.
  - Kiểm tra khóa sổ theo **thời điểm hiện tại**.
  - Writer khóa dòng vận đơn. Trạng thái đã bị người khác đổi trước thì lỗi `SHIPMENT_CHANGED` 409 "vừa được cập nhật, hãy tải lại" (`ShipmentStatusWriter.java:45-48`).
  - Mỗi lần đổi đều ghi log và audit "Vận đơn / Cập nhật trạng thái".
- **Khi nào ghi sổ**: các trạng thái trung gian chỉ đổi trạng thái và ghi lịch sử. Sổ đối tác và công nợ khách chỉ được ghi ở DELIVERED, RETURNED, CANCELLED (`ShipmentStatus.java:8-13`):
  - **DELIVERED** (`ShipmentStatusWriter.java:62-68,81-100`):
    - Hóa đơn phải `COMPLETED`, nếu không thì lỗi `INVOICE_NOT_COMPLETED`.
    - Tiền thu hộ ghi nhận = `max(min(cod_amount, total − paid), 0)`. Nếu > 0 thì:
      - hóa đơn `paid += thu hộ` (tiền chưa về quỹ, đang chờ đối soát);
      - nếu có khách: công nợ khách PAYMENT −thu hộ, note "Thu hộ qua đối tác giao hàng";
      - sổ đối tác COD **+thu hộ**.
    - Nếu `fee_payer = SHOP` và phí chưa ghi: sổ đối tác FEE **−phí**.
    - Cập nhật `delivered_at = now`.
  - **RETURNED** lần đầu (chưa có `return_id`):
    - Bắt buộc `refundMethod`, thiếu thì lỗi `REFUND_METHOD_REQUIRED`. `CREDIT` với khách lẻ bị chặn: lỗi `WALK_IN_CREDIT` (`ShipmentReturnService.java:41-52`).
    - Tạo phiếu trả hàng cho **toàn bộ hàng còn lại** của hóa đơn (hàng về kho). Id phiếu suy ra từ vận đơn (`nameUUIDFromBytes("shipment-return:"+id)`), nên gọi lại không tạo trùng (`ShipmentReturnService.java:54-78`).
    - Cách tính phiếu trả: tiền hàng mỗi dòng = `round(left × (unitPrice − discount), HALF_UP)`; giảm giá = `min(giảm giá HĐ, tiền hàng)`.
    - Hoàn tiền = `CREDIT` ? 0 : `max(min(paid, tiền hàng − giảm giá), 0)`, bằng CASH hoặc TRANSFER (`bankAccountId`).
    - Nếu phí chưa ghi: sổ đối tác FEE −phí giao (mặc định bằng `shipping_fee` của vận đơn, nhập tay được) và FEE −phí chuyển hoàn (mặc định 0). `fee_posted = phí giao + phí chuyển hoàn` (`ShipmentStatusWriter.java:69-75`).
    - Ở bước này phí luôn ghi cho cửa hàng chịu, không xét `fee_payer`.
  - **RETURNING** và các trạng thái chuyển hoàn trung gian: chưa nhập kho, chưa ghi phí.
  - **CANCELLED** (chỉ khi chưa lấy hàng): `status = CANCELLED`, `cod_amount = 0`. Hóa đơn giữ nguyên (khách vẫn nợ phần chưa trả). Sau đó tạo được vận đơn mới cho hóa đơn (`ShipmentRepository.java:98-101`, `ShipmentStatusService.java:17-22`).
- **Cập nhật hàng loạt** (`ShipmentStatusService.java:41-56`):
  - Lỗi ở một vận đơn không chặn các vận đơn khác; mỗi vận đơn trả về `{ok, message}`.
  - Nhập phí giao / phí chuyển hoàn khi chọn >1 vận đơn bị chặn: lỗi `FEE_PER_SHIPMENT`.
- **Sửa thông tin giao** (`BE/delivery/ShipmentEditService.java:25-43`):
  - Khóa dòng. Chỉ khi chưa lấy hàng, nếu không thì lỗi `SHIPMENT_IN_PROGRESS`. Đối tác phải đang hoạt động.
  - Sửa được: đối tác, người nhận, khu vực, trọng lượng, phí, người trả phí (null thì lấy SHOP), ghi chú, tỉnh / phường.
  - **Thu hộ không đổi**, vẫn theo hóa đơn.
- **Ràng buộc với hóa đơn** (`ShipmentInvoiceHooks.java:68-105`):
  - Sửa / hủy hóa đơn khi vận đơn đã lấy hàng: lỗi `SHIPMENT_IN_PROGRESS` "không {sửa|hủy} được hóa đơn".
  - Sửa hóa đơn:
    - chưa có vận đơn hoạt động thì tạo mới;
    - vận đơn chưa lấy hàng thì cập nhật thông tin giao và thu hộ theo tổng / đã trả mới;
    - không gửi thông tin giao thì chỉ cập nhật thu hộ (bằng 0 nếu `cod_enabled` tắt).
  - Hủy hóa đơn: vận đơn chưa lấy hàng chuyển CANCELLED, log "Hủy hóa đơn …".
- **Tạo vận đơn cho hóa đơn đã bán** (`BE/delivery/ShipmentCreateService.java:37-57`):
  - Khóa dòng hóa đơn, kiểm tra chi nhánh. Hóa đơn phải `COMPLETED` (lỗi `INVOICE_NOT_COMPLETED`). Kiểm tra khóa sổ (now).
  - Đang có vận đơn chưa hủy: lỗi `SHIPMENT_EXISTS`.
  - Hóa đơn đã có phiếu trả hàng hoàn thành: lỗi `INVOICE_HAS_RETURNS`.
  - Đặt `invoice.saleMode = DELIVERY`. Không đụng kho. Thu hộ = khách cần trả − đã trả hiện tại.
- **Tỷ lệ giao thành công theo SĐT** = `round(delivered × 100 / (delivered + returned))`; null nếu chưa có vận đơn kết thúc (`BE/delivery/ShipmentInvoiceRepository.java:80-91`).
- **Hiển thị trên hóa đơn**: ưu tiên vận đơn đang hoạt động; không có thì lấy vận đơn đã hủy gần nhất (`ShipmentInvoiceRepository.java:61-66`).
- **Số tiền ở chi tiết vận đơn** (`BE/delivery/ShipmentQueryRepository.java:147-165`):
  - `codOpen` (thu hộ còn cần thu): bằng 0 nếu đã đối soát / đã hủy / đang hoặc đã chuyển hoàn; ngược lại là `cod_posted`, chưa ghi thì là `cod_amount`.
  - `partnerFee` (phí trả ĐTGH): bằng `fee_posted`; chưa ghi thì bằng phí giao nếu SHOP trả, bằng 0 nếu hủy hoặc người nhận trả.
  - `partnerFeeOpen` = 0 nếu đã đối soát.
- **FE**:
  - Nút đổi trạng thái chỉ hiện các bước hợp lệ.
  - Hỏi xác nhận trước khi đổi; với DELIVERED, RETURNING, CANCELLED có thêm câu cảnh báo (`FE/features/delivery/use-shipment-status.ts:18-24`).
  - RETURNED mở hộp thoại chọn hoàn tiền + phí (`shipment-returned-dialog.tsx`). Khi 1 vận đơn: phí giao mặc định bằng phí vận đơn, phí chuyển hoàn mặc định 0. Khi hàng loạt: chỉ chọn cách hoàn tiền.

**4. Danh sách — bộ lọc / cột / xuất**
- Bộ lọc backend (`ShipmentQueryRepository.java:45-105`):
  - `q`: mã vận đơn, `waybill_code`, mã hóa đơn, tên / SĐT người nhận, tên khách (ILIKE)
  - `statuses`, `partnerId`
  - `provinceCode`: vận đơn cũ chưa có mã tỉnh thì khớp theo `area` / địa chỉ
  - `area`
  - `from` / `to` theo `created_at`; `completedFrom` / `completedTo` theo `delivered_at`
  - `cod`: true là `cod_amount > 0`, false là `= 0`
  - `connection`: `p.partner_type`
  - `reconciled`
- Bảng đếm theo trạng thái (thanh tab) áp mọi bộ lọc trừ bộ lọc trạng thái. Dòng tổng gồm `sumFee`, `sumCod`. Sắp `created_at desc`.
- Sidebar FE (`FE/features/delivery/shipment-filter-sidebar.tsx:17-91`):
  - Trạng thái (chọn nhiều), Đối tác (gồm cả đối tác ngừng hoạt động)
  - Thời gian tạo: mặc định "tháng này"; link sâu thì mọi thời gian
  - Thời gian hoàn thành
  - Khu vực (tỉnh): gửi `provinceCode` kèm `area` = tên tỉnh rút gọn
  - Thu hộ: Tất cả / Có / Không
- Cột (chọn được, lưu ở `delivery.shipments.columns`):
  - Đầy đủ theo thứ tự: Mã vận đơn đối tác (trống thì hiện "---") | Thời gian tạo | Hóa đơn | Mã KH | Khách | Đối tác | Trạng thái | Thời gian giao | Người nhận | SĐT | Địa chỉ | Khu vực | Thu hộ | Phí | Hoàn thành | Dịch vụ | Mã VD
  - Mặc định ẩn: Địa chỉ, Khu vực, Dịch vụ, Mã VD

  (`FE/features/delivery/shipment-list-columns.tsx:14-18`)
- Xuất **xlsx**: mọi vận đơn khớp bộ lọc (tải từng trang 200), đúng các cột đang hiện (`shipment-xlsx-export.ts:8-22`).
  - Tên file `{Tên}_KVddMMyyyy-HHmmss-SSS.xlsx`, cột tiền định dạng `#,##0`, có autofilter.
  - Ô chữ bắt đầu bằng `= + - @` được thêm `'` để chặn công thức (`delivery-xlsx.ts:1-13`).
- Chọn nhiều vận đơn (khi có `sales.perform`) thì hiện thanh cập nhật trạng thái hàng loạt. Nút "Đối soát" mở hộp thoại đối soát (3.9).

**5. Giới hạn**
- Chưa tích hợp API hãng vận chuyển. Mọi trạng thái cập nhật tay (`ShipmentController.java:32`, `MIG/V10__delivery.sql:2`).
- FE xác định "khách lẻ" (để không cho chọn CREDIT) bằng `customerName === "Khách lẻ"` (`shipment-detail-panel.tsx:85`). Backend kiểm tra bằng `customer_id` null.
- Comment cột `status` trong V10 chỉ liệt kê 7 trạng thái, trong khi code dùng 12.

---

### 3.8 Đối tác giao hàng (nhóm, loại, công nợ)

**1. Màn hình / API**
- Route `/delivery/partners` (`APP/delivery/partners/page.tsx`).
  - Thẻ trái: Tích hợp (luôn trống) | Khác (đối tác của cửa hàng).
  - Tab: Thông tin | Lịch sử giao hàng (vận đơn mọi đối tác) | Lịch sử đối soát.
  - Link sâu `?code=DT…` mở đối tác; `?code=DS…` mở đối tác sở hữu phiếu đối soát, ở tab thanh toán (`partners/page.tsx:30-38`).
- Chi tiết đối tác có các tab: Thông tin | Vận đơn | Sổ công nợ | Thanh toán, kèm nút xóa và hủy phiếu (`FE/features/delivery/partner-detail-panel.tsx:46-108`).
- Quyền mức lớp: `sales.perform` OR `report.view` (`BE/delivery/DeliveryPartnerController.java:35`).

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/delivery-partners?q&active&debt=OWING\|PAYABLE&page&size` | lớp; `size` 1..200 |
| GET | `/api/delivery-partners/settlements?page&size=50` | lớp; mọi phiếu đối soát |
| GET | `/api/delivery-partners/{id}` | lớp |
| GET | `/api/delivery-partners/{id}/ledger` | lớp |
| GET | `/api/delivery-partners/{id}/settlements` | lớp |
| GET | `/api/delivery-partners/{id}/reconcilable?branchId=` | lớp |
| POST / PUT / DELETE | `/api/delivery-partners[/{id}]` | `sales.perform` |
| GET | `/api/delivery-partners/groups` | `sales.perform` OR `report.view` |
| POST | `/api/delivery-partners/groups` | `sales.perform` |

**2. Dữ liệu**
- Bảng `delivery_partners` (`MIG/V10__delivery.sql:7-21`, cùng V12, V16):
  - `code` UNIQUE: `DT%06d` từ `delivery_partner_code_seq`, hoặc mã nhập tay `^[A-Za-z0-9_.-]+$` ≤30, lưu dạng viết hoa
  - `name` ≤200, `phone`, `email`, `address`, `note` ≤2000
  - `partner_type` = kiểu kết nối, hiện chỉ `MANUAL`
  - `partner_kind` PERSONAL|COMPANY (mặc định PERSONAL)
  - `group_id` → `delivery_partner_groups` (ON DELETE SET NULL)
  - `province`, `ward`, `*_code`, `active`, `debt`, `created_by`, `created_at`
- Bảng `delivery_partner_groups(id, name ≤100, created_by, created_at)`, UNIQUE `lower(name)` (`MIG/V16__delivery_sale_kiotviet_parity.sql:4-10`).
- Bảng `delivery_partner_ledger(partner_id, branch_id, doc_type COD|FEE|SETTLEMENT|SETTLEMENT_CANCEL, doc_id, doc_code, amount, balance_after, note ≤300, occurred_at, created_at)` (`V10:86-100`).
- **Dấu sổ đối tác**: `amount > 0` nghĩa là đối tác nợ cửa hàng (COD đã thu hộ); `< 0` nghĩa là cửa hàng nợ đối tác (phí), hoặc đối tác đã trả cửa hàng. `delivery_partners.debt` = Σ amount; amount = 0 thì không ghi (`BE/delivery/PartnerLedger.java:12-42`).

| doc_type | amount |
|---|---|
| COD | +thu hộ (DELIVERED) |
| FEE | −phí giao / −phí chuyển hoàn |
| SETTLEMENT | −chênh lệch phiếu (phiếu thu: −; phiếu chi: +) |
| SETTLEMENT_CANCEL | +chênh lệch (đảo SETTLEMENT) |

**3. Quy tắc**
- Validation (`BE/delivery/DeliveryPartnerDtos.java:26-35`): `name` bắt buộc, email đúng định dạng, `partnerType` chỉ `MANUAL`, `partnerKind` PERSONAL|COMPANY.
- Mặc định khi tạo / sửa: `active = true` khi null, `partnerType = MANUAL`, `partnerKind = PERSONAL` (`DeliveryPartnerRepository.java:142-172`, `DeliveryPartnerService.java:75-77`).
- Mã:
  - Trùng: lỗi `PARTNER_CODE_DUPLICATE` 409.
  - Khi sửa: để trống thì giữ mã cũ. Không tìm thấy đối tác: lỗi `PARTNER_NOT_FOUND`.
- Nhóm không tồn tại: lỗi `PARTNER_GROUP_NOT_FOUND`. Tên nhóm được trim và gộp khoảng trắng; trùng thì lỗi `PARTNER_GROUP_DUPLICATE` 409 (`DeliveryPartnerGroupService.java:30-40`).
- Nhóm đối tác chỉ có danh sách và thêm mới; **không có sửa / xóa**.
- Xóa đối tác: khóa dòng. Đã có vận đơn hoặc dòng sổ công nợ thì lỗi `PARTNER_IN_USE` 409, cần chuyển sang ngừng hoạt động (`DeliveryPartnerService.java:53-67`).
- Đối tác ngừng hoạt động không chọn được cho vận đơn mới hoặc khi sửa vận đơn (`ShipmentInvoiceHooks.java:49-52`).
- Số liệu mỗi đối tác (`DeliveryPartnerRepository.java:28-39`):
  - `shipmentCount`: số vận đơn chưa hủy; `shipmentTotal`: gồm cả đã hủy
  - `totalFee`: Σ phí các vận đơn chưa hủy
  - `totalCod`: Σ thu hộ các vận đơn không hủy và không ở luồng chuyển hoàn
  - `codOpen` / `feeOpen`: Σ `cod_posted` / `fee_posted` đã ghi sổ nhưng chưa đối soát
  - `debt`: nợ hiện tại
- Audit "Đối tác giao hàng / Tạo|Sửa|Xóa".

**4. Danh sách**
- Lọc theo `q` (mã / tên / SĐT), trạng thái hoạt động, và công nợ: OWING (`debt > 0`) / PAYABLE (`debt < 0`). Sắp `created_at desc`.
- Cột (chọn được): Mã | Tên | Tổng đơn | Thu hộ | Còn cần thu COD | Phí | Còn cần trả ĐTGH (`FE/features/delivery/partner-list-table.tsx:17-28`).
- Xuất xlsx: tải mọi trang (200/lần), đúng các cột đang hiện (`partners/page.tsx:64-78`).

**5. Giới hạn**
- Không có đối tác tích hợp. Thẻ "Tích hợp" luôn trống (`partners/page.tsx:31`, `DeliveryPartnerDtos.java:22-25`).
- Cột "Tổng đơn" ở từng dòng dùng `shipmentCount` (không gồm đã hủy), nhưng dòng tổng lại dùng `sumShipments` = Σ `cnt_all` (gồm cả đã hủy) (`partner-list-table.tsx:25,42`, `DeliveryPartnerRepository.java:69-75`).
- Sổ công nợ và lịch sử thanh toán của một đối tác không lọc theo chi nhánh người dùng. Phiếu đối soát toàn hệ thống cũng vậy.

---

### 3.9 Đối soát / thanh toán với đối tác giao hàng

**1. Màn hình / API** (quyền mức lớp `sales.perform`, `BE/delivery/DeliverySettlementController.java:22-48`)

| Method | Path | Nghiệp vụ |
|---|---|---|
| POST | `/api/delivery-partners/{id}/reconcile` | đối soát theo danh sách vận đơn |
| POST | `/api/delivery-partners/{id}/payments` | thanh toán tự do (RECEIPT / PAYMENT) |
| POST | `/api/delivery-partners/settlements/{settlementId}/cancel` | hủy phiếu |

- UI:
  - `ReconcileDialog`: mở từ Vận đơn hoặc từ đối tác (`FE/features/delivery/reconcile-dialog.tsx`).
  - `PartnerPaymentDialog`: chiều mặc định theo dấu nợ (đối tác nợ thì Thu; cửa hàng nợ thì Trả), số tiền gợi ý = |nợ| (`partner-payment-dialog.tsx:24-39`).

**2. Dữ liệu**
- Bảng `delivery_settlements` (`MIG/V10__delivery.sql:66-83`):
  - `code` UNIQUE: `DS%06d` từ `delivery_settlement_code_seq`
  - `partner_id`, `branch_id`, `kind` RECONCILE|RECEIPT|PAYMENT
  - `cod_total`, `fee_total`, `amount` (>0: đối tác trả cửa hàng; <0: cửa hàng trả đối tác), `shipment_count`
  - `voucher_id` → `cash_vouchers`, `status` COMPLETED|CANCELLED
  - `note`, `created_by*`, `created_at`, `cancelled_at`
- Vận đơn đã đối soát mang `shipments.settlement_id`.
- Phiếu Sổ quỹ đi kèm có mã `PT{DS…}` hoặc `PC{DS…}`, ví dụ `PTDS000001` (`DeliverySettlementService.java:121`).

**3. Quy tắc**
- **Đối soát** (`DeliverySettlementService.java:46-71`):
  - Kiểm tra chi nhánh và khóa sổ (now). Khóa các vận đơn được chọn.
  - Có id không tồn tại (so theo số id distinct): lỗi `SHIPMENT_NOT_FOUND`.
  - Mỗi vận đơn phải cùng đối tác, cùng chi nhánh, chưa đối soát, và đang `DELIVERED` hoặc `RETURNED`. Sai điều kiện thì lỗi `SHIPMENT_NOT_RECONCILABLE`.
  - Tính `cod = Σ cod_posted`, `fee = Σ fee_posted` (null tính 0); **chênh lệch = cod − fee**. Sau đó gắn `settlement_id` cho các vận đơn.
- **Thanh toán tự do** (`DeliverySettlementService.java:73-81`):
  - `amount ≥ 1`, được làm tròn HALF_UP.
  - `direction`: RECEIPT ghi +amount, PAYMENT ghi −amount; `shipment_count = 0`.
- **Lập phiếu** (`settle`, `DeliverySettlementService.java:108-148`):
  - Đối tác không tồn tại: lỗi `PARTNER_NOT_FOUND`.
  - Nếu `amount ≠ 0`:
    - `amount > 0` sinh phiếu thu "Thu tiền đối tác giao hàng"; `amount < 0` sinh phiếu chi "Chi tiền đối tác giao hàng"; số tiền phiếu = |amount|.
    - Quỹ: `fund` null thì lấy CASH.
    - Thuộc tính phiếu: `partnerType = DELIVERY_PARTNER`, `sourceType = DELIVERY`, `accounting = false`, `affectsDebt = false`.
    - Ghi chú mặc định "Đối soát N vận đơn".
  - `amount = 0` thì không có phiếu Sổ quỹ.
  - Sổ đối tác ghi SETTLEMENT với **−amount**.
- **Hủy phiếu** (`DeliverySettlementService.java:83-106`):
  - Không tìm thấy phiếu: lỗi `SETTLEMENT_NOT_FOUND`. Phiếu đã hủy: trả kết quả, không làm gì thêm.
  - Kiểm tra chi nhánh và khóa sổ theo `created_at` **của phiếu**.
  - Hủy phiếu Sổ quỹ (không đi qua chặn `VOUCHER_AUTO`), chuyển phiếu sang CANCELLED, gỡ `settlement_id` để vận đơn quay lại chờ đối soát, và ghi SETTLEMENT_CANCEL **+amount**.
- Phiếu Sổ quỹ nguồn DELIVERY không hủy được từ Sổ quỹ: lỗi `VOUCHER_AUTO` (`CashbookService.java:87-91`).
- Audit "Đối tác giao hàng / Đối soát | Thanh toán | Hủy đối soát" (`DeliverySettlementManageService.java:25-43`).
- **Danh sách chờ đối soát**: vận đơn DELIVERED / RETURNED, chưa có `settlement_id`, trong chi nhánh của người dùng; sắp theo `delivered_at nulls last, created_at`; `net = cod − fee` (`DeliveryPartnerRepository.java:121-135`).
- FE đối soát (`reconcile-dialog.tsx:44-112`):
  - Mặc định chọn hết; người dùng bỏ chọn từng dòng.
  - Hiển thị Tổng thu hộ, Tổng phí, và "Đối tác trả" hoặc "Cửa hàng trả" = |net|.
  - Chọn quỹ CASH / BANK / EWALLET.

**5. Giới hạn**
- FE đối soát và FE thanh toán không gửi `bankAccountId` (`reconcile-dialog.tsx:53-54`, `partner-payment-dialog.tsx:41-42`), nên phiếu quỹ BANK / EWALLET không gắn tài khoản.
- Thanh toán tự do không gắn vận đơn nào; vận đơn vẫn ở trạng thái chờ đối soát.

---

### 3.10 Quản lý giao hàng (Thống kê, Dòng tiền)

**1. Màn hình / API**
- Route `/delivery` (`APP/delivery/page.tsx`): menu QUẢN LÝ có Thống kê | Dòng tiền. Có bộ lọc, nhãn "Cập nhật lúc HH:mm" kèm nút tải lại.
- Bấm thẻ hoặc dòng trạng thái thì mở `/delivery/shipments` đã lọc sẵn (`delivery/page.tsx:30-37`).
- API: `GET /api/shipments/dashboard`, `GET /api/shipments/cashflow` (bắt buộc `from`, `to`; tùy chọn `partnerId`, `connection`), quyền `sales.perform` OR `report.view`. Phạm vi luôn trong các chi nhánh của người dùng (`ShipmentManageService.java:66-74`).

**3. Quy tắc**
- **Thống kê** (`BE/delivery/ShipmentDashboardRepository.java:36-61`):
  - Lấy vận đơn có `created_at ∈ [from, to)`. Với mỗi trạng thái (đủ 12, theo thứ tự KiotViet): số đơn, Σ `cod_amount`, Σ `shipping_fee`.
  - Các số tổng (đơn, thu hộ, phí) **không tính đơn đã hủy**.
  - Thẻ "Giao thất bại" = số đơn WAIT_REDELIVER. Thẻ "Chờ chuyển hoàn" = số đơn WAIT_RETURN.
  - "Quá hạn" = `expected_delivery_at < now()` và trạng thái thuộc PENDING / PICKING / PICKED / WAIT_REPICK / DELIVERING / WAIT_REDELIVER.
- **Dòng tiền** (`ShipmentDashboardRepository.java:63-77`), mỗi đối tác:
  - Lấy các dòng sổ đối tác có `occurred_at ∈ [from, to)`, `branch_id` thuộc chi nhánh của người dùng.
  - `codCollected` = Σ COD.
  - `feeCharged` = −Σ FEE.
  - `settled` = −Σ (SETTLEMENT + SETTLEMENT_CANCEL): >0 nghĩa là đối tác đã trả cửa hàng; <0 nghĩa là cửa hàng đã trả đối tác.
  - `balance` = `delivery_partners.debt` hiện tại.
  - Sắp theo mã đối tác; có dòng tổng.
- Bộ lọc FE (`FE/features/delivery/delivery-dashboard-filters.tsx:14-37`):
  - Hình thức kết nối: Tất cả / Tự giao hàng (`MANUAL`). Hai lựa chọn "Cổng" và "Hãng vận chuyển" bị disabled ("chưa kết nối").
  - Đối tác: chọn 1 đối tác, hoặc "OTHER" = mọi đối tác tự quản lý (gửi `connection = MANUAL`).
  - Thời gian tạo: hôm nay / hôm qua / **7 ngày (mặc định)** / tháng này / tháng trước / tùy chọn. Khoảng gửi lên là [from, to+1 ngày).

**5. Giới hạn**
- `balance` lấy `debt` toàn hệ thống: không theo kỳ và không lọc theo chi nhánh. Ba cột còn lại thì có lọc chi nhánh. Ngoài ra danh sách gồm mọi đối tác, kể cả đối tác không phát sinh trong kỳ (LEFT JOIN).
- Không có thẻ điều chỉnh cước, cột bồi hoàn, hay "giao thất bại thu tiền", vì chưa tích hợp hãng vận chuyển (`APP/delivery/page.tsx:15-19`).


---

## 4. Tài khoản, thiết lập, nhân viên

> Phạm vi: `backend/identity-service` (gói `com.vaxclinic.identity`, gọi tắt `id/`), `backend/gateway-service`, phần dùng chung `backend/common-lib` (gọi tắt `common/`), frontend auth/settings/store-profile/hr/print. Đường dẫn rút gọn:
> - `id/` = `backend/identity-service/src/main/java/com/vaxclinic/identity/`
> - `mig/` = `backend/identity-service/src/main/resources/db/migration/`
> - `gw/` = `backend/gateway-service/src/main/`
> - `common/` = `backend/common-lib/src/main/java/com/vaxclinic/common/`
> - `fe/` = `frontend/src/`
>
> Bí mật chỉ nêu tên biến (`JWT_SECRET`, `ENCRYPTION_KEY`, `ADMIN_PASSWORD`, `DB_PASSWORD`...), không ghi giá trị.

Quy ước lỗi chung (mọi service): body `ApiError {code, message, details[], timestamp}` (`common/error/GlobalExceptionHandler.java:23-60`):
- `BusinessException` → status + code riêng; `@Valid` lỗi → 400 `VALIDATION_FAILED` + `details[{field,message}]`; JSON hỏng / UUID sai → 400 `MALFORMED_REQUEST`; thiếu query param → 400 `MISSING_PARAMETER`; thiếu quyền → 403 `FORBIDDEN` "Bạn không có quyền thực hiện thao tác này"; lỗi khác → 500 `INTERNAL_ERROR`.
- Múi giờ nghiệp vụ: `Asia/Ho_Chi_Minh` (`common/settings/ShopSettings.java:20`).
- Lịch sử thao tác: mọi thao tác ghi gọi `AuditLogger.record(...)`, detail cắt 1000 ký tự; lỗi ghi log chỉ cảnh báo, không làm hỏng nghiệp vụ (`common/audit/AuditLogger.java:6-22`, `id/audit/JdbcAuditLogger.java:22-28`).

---

### 4.1 Gateway: định tuyến, xác thực, bảo lưu gian hàng

**1. Mục đích + route**
- Spring Cloud Gateway (WebFlux), cổng `GATEWAY_PORT` (mặc định 8080) (`gw/resources/application.yml:1-2`). Chỉ expose actuator `health` (`:49-53`).

**Bảng định tuyến** (`gw/resources/application.yml:15-47`)

| Route id | Đích (biến môi trường, mặc định) | Path | order |
|---|---|---|---|
| `integration-store-profile` | `INTEGRATION_URL` (:8088) | `/api/store-profile/einvoice/**`, `/api/store-profile/certificates/**` | -1 (khớp trước identity) |
| `identity` | `IDENTITY_URL` (:8081) | `/api/auth/**, /api/users/**, /api/roles/**, /api/branches/**, /api/settings/**, /api/print-templates/**, /api/audit-logs/**, /api/hr/**, /api/notifications/**, /api/announcements/**, /api/store-profile/**` | 0 |
| `product-reports` | `PRODUCT_URL` (:8082) | `/api/reports/inventory/**, /api/reports/suppliers/**` | -1 (khớp trước `/api/reports/**` của sales) |
| `product` | `PRODUCT_URL` | `/api/products, categories, tax-rates, positions, suppliers, purchase-receipts, purchase-returns, stock-takes, stock-issues, accounting/stock, price-books` | 0 |
| `sales` | `SALES_URL` (:8086) | `/api/customers, invoices, cashbook, bank-accounts, sales-returns, accounting/revenue, customer-groups, orders, reports, sales-channels, delivery-partners, shipments` | 0 |
| `integration` | `INTEGRATION_URL` | `/api/tax-connections, input-invoices, einvoice, einvoices, payments, payment-requests` | 0 |

- **`/internal/**` KHÔNG có route** → trình duyệt không chạm được endpoint nội bộ; chỉ gọi service-to-service bằng JWT nội bộ quyền `internal` (`gw/resources/application.yml:38`, `common/security/ServiceTokenProvider.java:14-18`).

**2. Xác thực tại gateway** (`gw/java/com/vaxclinic/gateway/GatewaySecurityConfig.java:24-38`)
- Kiểm JWT HS256 bằng `JWT_SECRET`; CSRF tắt.
- Public (không cần JWT): `/actuator/health/**`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/store`, `/api/auth/store-status`, `/api/payments/sepay/webhook` (webhook SePay — xác thực bằng API key ở integration-service). Mọi path khác cần JWT.
- Mỗi service tự kiểm lại JWT (common `JwtResourceServerAutoConfiguration`): stateless, `perms` claim → authorities, `@PreAuthorize("hasAuthority('...')")`; public paths của identity: `app.security.public-paths` = login, refresh, logout, store, store-status (`common/security/JwtResourceServerAutoConfiguration.java:41-67`, `backend/identity-service/src/main/resources/application.yml:27-28`).

**3. Quy tắc `StoreStatusFilter`** (GlobalFilter, `HIGHEST_PRECEDENCE`) (`gw/java/com/vaxclinic/gateway/StoreStatusFilter.java:22-100`)
- Đọc `GET {IDENTITY_URL}/api/auth/store-status` → `{paused, reopenOn, pauseUsed, sessionsNotBefore}`; cache **5 giây**, timeout 2 giây; identity lỗi → dùng bản đọc gần nhất, chưa có → coi như đang mở (`:36-37, :76-92`).
- JWT có `iat < sessionsNotBefore` (sau khi đổi tên gian hàng) → **401 `SESSION_REVOKED`** "Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại" (`:55-63`).
- Gian hàng đang bảo lưu → **423 `STORE_PAUSED`** "Gian hàng đang bảo lưu", trừ: path không bắt đầu `/api/`, `/api/auth/**`, `/api/store-profile**`, và `GET /api/settings**` (`:64-74`).
- Body lỗi dựng tay cùng shape ApiError (`:94-100`).

**4. Rate limit / security headers**
- Gateway: **không có** rate limit hay security headers trong code gateway (chỉ 3 file Java). Giới hạn duy nhất ở backend là đếm đăng nhập sai trong identity (mục 4.2). (Security headers phía frontend: xem mục 4.17.)

**5. Giới hạn đã biết**
- Cache trạng thái gian hàng 5 giây → bảo lưu/đổi tên có hiệu lực chậm tối đa ~5 giây tại gateway.
- Body lỗi ghép chuỗi JSON thủ công (message cố định nên không thoát ký tự).

---

### 4.2 Đăng nhập & phiên (JWT, refresh, 2FA TOTP, mã khôi phục, khóa tài khoản, điều khoản)

**1. Mục đích + API**

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/api/auth/store?code=` | public | Bước 1 "Địa chỉ truy cập cửa hàng" → `{code,name,logo}` (`id/settings/StoreAccessController.java:40-49`) |
| GET | `/api/auth/store-status` | public | Trạng thái bảo lưu/mốc phiên (`id/storeprofile/StoreStatusController.java:21-24`) |
| POST | `/api/auth/login` `{username,password,code?}` | public | → `TokenPair{accessToken, refreshToken, expiresIn}` (`id/auth/AuthController.java:45-48`) |
| POST | `/api/auth/refresh` `{refreshToken}` | public | xoay vòng refresh token (`:50-53`) |
| POST | `/api/auth/logout` `{refreshToken}` | public (refresh token là thẩm quyền) | 204; xóa dòng refresh token còn sống → refresh lại bằng token đó 401; token lạ/đã thu hồi → vẫn 204 (`:55-59`, `id/auth/AuthService.java:102-114`) |
| GET | `/api/auth/me` | JWT | `{user, permissions[], twoFactorEnabled, storeOwner}` — FE dựng menu từ đây (`:38-64`) |
| GET | `/api/auth/2fa` | JWT | `{enabled, pending, recoveryCodesLeft}` (`id/auth/twofactor/TwoFactorController.java:37-40`) |
| POST | `/api/auth/2fa/setup` | JWT | `{secret (Base32), otpauthUrl}` (`:42-45`) |
| POST | `/api/auth/2fa/enable` `{code}` | JWT | → `{recoveryCodes[10]}` (`:47-50`) |
| POST | `/api/auth/2fa/disable` `{password,code}` | JWT | (`:52-55`) |
| POST | `/api/auth/2fa/recovery-codes` `{password,code}` | JWT | tạo lại 10 mã (`:57-60`) |
| GET | `/api/auth/terms` | JWT | `{version, effectiveDate, acceptedAt}` (`id/terms/TermsController.java:26-29`) |
| POST | `/api/auth/terms/accept` `{version}` | JWT | (`:31-34`) |

**2. Dữ liệu**
- `users(id, username UNIQUE, password_hash, full_name, phone, active, role_id, created_at, owner)`; `user_branches(user_id, branch_id)`; `refresh_tokens(id, user_id, token_hash SHA-256 UNIQUE, expires_at, revoked)` (`mig/V1__init_identity_schema.sql:26-52`); `users.owner` + chỉ mục duy nhất `uq_users_single_owner` (`mig/V8__store_owner_2fa_terms.sql:2-6`).
- `user_totp(user_id PK, secret_enc, enabled, last_step, failed_attempts, locked_until, created_at, enabled_at)`; `user_recovery_codes(id, user_id, code_hash, used_at)`; `terms_acceptances(user_id, version, accepted_at)` (`mig/V8__store_owner_2fa_terms.sql:11-37`).

**3. Quy tắc nghiệp vụ**
- **Access JWT** HS256, issuer `vaxclinic-identity`, TTL **30 phút** (`app.jwt.access-ttl-minutes`), claims: `sub`=userId, `username`, `name`, `role` (mã vai trò), `perms` (danh sách quyền), `branches` (id chi nhánh) (`id/auth/TokenService.java:40-56`, `backend/identity-service/src/main/resources/application.yml:23-26`). Đổi quyền/chi nhánh chỉ có hiệu lực khi refresh/đăng nhập lại (`id/role/RoleController.java:23-26`).
- **Refresh token**: 32 byte ngẫu nhiên Base64URL, chỉ lưu SHA-256; TTL **7 ngày** (`app.jwt.refresh-ttl-days`) (`id/auth/TokenService.java:62-75`, `id/auth/AuthService.java:106-115`).
  - Mỗi refresh: thu hồi token cũ, cấp cặp mới (rotation) (`id/auth/AuthService.java:75-89`).
  - Dùng lại token đã thu hồi → thu hồi **mọi** phiên của user (dấu hiệu đánh cắp) + 401 `INVALID_REFRESH_TOKEN` "Phiên đăng nhập đã hết hạn" (`:79-82`).
  - Hết hạn / user không active → 401 `INVALID_REFRESH_TOKEN` (`:83-87`).
- **Login** (`id/auth/AuthService.java:57-73`):
  1. `LoginAttemptLimiter.checkAllowed(username, ip)` → đang khóa: **429 `LOGIN_RATE_LIMITED`** "Đăng nhập sai quá nhiều lần, thử lại sau X phút".
  2. Tìm user không phân biệt hoa thường (trim); sai user/mật khẩu (BCrypt) → ghi lần sai + **401 `BAD_CREDENTIALS`** "Sai tên đăng nhập hoặc mật khẩu".
  3. `active=false` → **403 `USER_LOCKED`** "Tài khoản đã bị khóa".
  4. Đã bật 2FA: thiếu mã → **401 `TOTP_REQUIRED`** (FE hiện ô nhập mã); sai mã → 400 `TOTP_INVALID`/429 `TOTP_LOCKED` (không tính vào giới hạn mật khẩu) (`id/auth/twofactor/TwoFactorService.java:117-123`).
  5. Thành công → xóa bộ đếm, cấp token.
- **Giới hạn đăng nhập sai** (`id/auth/LoginAttemptLimiter.java:14-82`): khóa theo `(lower(username) | IP)`; sai **5** lần trong cửa sổ **15 phút** → khóa **5 phút**; trong lúc khóa mọi lần thử (kể cả đúng mật khẩu) 429; lưu RAM (restart → về 0; nhiều instance → đếm riêng); job dọn mỗi 60 giây (`id/auth/LoginAttemptCleanupScheduler.java:16-19`).
  - IP = phần tử **cuối** của `X-Forwarded-For` (gateway nối thêm) hoặc địa chỉ TCP (`id/auth/ClientIpResolver.java:5-26`). Qua BFF Next.js thì IP là máy BFF → thực tế giới hạn theo tên đăng nhập.
- **2FA TOTP** (RFC 6238, HMAC-SHA1, 6 số, bước 30 giây, khóa 160 bit, chấp nhận lệch ±1 bước; bước đã dùng (`last_step`) không dùng lại) (`id/auth/twofactor/TotpAlgorithm.java:9-60`).
  - Setup: đang bật → 409 `TOTP_ALREADY_ENABLED`; tạo khóa mới (thay khóa đang chờ), `otpauth://totp/{issuer}:{username}?secret=..&issuer=..&algorithm=SHA1&digits=6&period=30`; issuer = tên cửa hàng (`store.name`), thiếu → "VaxClinic" (`id/auth/twofactor/TwoFactorService.java:72-84`, `id/auth/twofactor/TwoFactorAccountService.java:41-44`).
  - Enable: đang bật → 409; chưa setup → 400 `TOTP_NOT_SETUP` "Tạo mã QR trước khi xác nhận"; chỉ nhận TOTP (không nhận mã khôi phục) → sinh **10 mã khôi phục** dạng `xxxxx-xxxxx` (10 ký tự Base32 thường), chỉ hiện 1 lần, lưu HMAC-SHA256 (`TwoFactorService.java:86-99, :152-162`).
  - Disable: chưa bật → 400 `TOTP_NOT_ENABLED`; mật khẩu sai → 400 `BAD_PASSWORD`; nhận TOTP **hoặc** mã khôi phục; xóa khóa + mã (`:101-107`).
  - Tạo lại mã khôi phục: cần mật khẩu + TOTP (không nhận mã khôi phục), thay toàn bộ bộ cũ (`:109-115`).
  - Kiểm mã (`id/auth/twofactor/TotpVerifier.java:14-65`): chuẩn hóa bỏ khoảng trắng/gạch, chữ thường; 6 số → TOTP; `[a-z2-7]{10}` → mã khôi phục (nếu cho phép, dùng xong hủy); sai **5** lần liên tiếp → khóa nhập mã **5 phút** (429 `TOTP_LOCKED`); sai → **400** `TOTP_INVALID` "...còn N lần thử" (400 thay vì 401 để BFF không tự refresh); giao dịch `REQUIRES_NEW` + `SELECT ... FOR UPDATE` để bộ đếm không bị rollback/đua.
  - Mỗi bật/tắt/tạo lại mã → Lịch sử thao tác tính năng "Tài khoản", hành động "Sửa" (`TwoFactorAccountService.java:46-66`).
  - **Lưu bí mật**: `secret_enc` = AES-256-GCM `base64(iv12 || ct+tag)`; khóa AES và pepper HMAC mã khôi phục dẫn xuất HMAC-SHA256 từ `ENCRYPTION_KEY` (thiếu → `JWT_SECRET`) với nhãn riêng; đổi `ENCRYPTION_KEY` → mọi user phải bật lại 2FA (`id/auth/twofactor/TotpSecretCipher.java:17-63`, `backend/identity-service/src/main/resources/application.yml:34-36`).
- **Xác nhận danh tính cho thao tác nhạy cảm** (`confirmIdentity`): đã bật 2FA → bắt buộc mã Authenticator (thiếu → 400 `TOTP_REQUIRED`), chưa bật → mật khẩu hiện tại (sai → 400 `BAD_PASSWORD`). Thay cho OTP SMS (`TwoFactorService.java:125-138`).
- **Khóa tài khoản**: `users.active=false` (từ Quản lý người dùng) → không đăng nhập được (403 `USER_LOCKED`), mọi refresh token bị thu hồi (`id/user/UserService.java:104-107`).
- **Đặt lại mật khẩu**: chỉ admin (`user.manage`) đặt mật khẩu mới cho user (≥ 8 ký tự), thu hồi mọi phiên; **không có** luồng "quên mật khẩu" tự phục vụ (`id/user/UserService.java:113-119`, `id/user/UserController.java:76-80`).
- **Điều khoản sử dụng** (`id/terms/TermsService.java:12-48`): phiên bản hiện hành `CURRENT_VERSION = "1.0"`, hiệu lực `2026-11-01`; nội dung nằm ở FE `features/store-profile/terms-of-use-content.ts` — đổi nội dung phải tăng version ở cả hai nơi; accept với version khác → 400 `TERMS_VERSION` "Điều khoản đã có phiên bản mới..."; lần đồng ý đầu ghi Lịch sử thao tác "Tài khoản / Đồng ý".
- **Admin đầu tiên** (`id/config/IdentityBootstrap.java:23-82`): khởi động → vai trò `ADMIN` được bổ sung **mọi** quyền trong `Permissions.ALL`; nếu chưa có user `ADMIN_USERNAME` (mặc định `admin`) và `ADMIN_PASSWORD` ≥ 8 ký tự → tạo admin (full_name = username, mọi chi nhánh); thiếu mật khẩu → bỏ qua + cảnh báo. Mật khẩu băm BCrypt.
- **Chủ gian hàng**: sau khởi động, chưa có owner → gán cho ADMIN active tạo sớm nhất (`id/storeprofile/StoreOwnershipService.java:60-72`).

**5. Giới hạn đã biết**
- Bộ đếm đăng nhập sai trong RAM, không chia sẻ giữa instance.
- Không có quên mật khẩu qua email/SMS; không có tự đổi mật khẩu ở backend identity (chỉ admin reset) — FE xem mục 4.15.
- Access token còn hiệu lực tới 30 phút sau khi khóa user / đổi quyền (chỉ refresh bị chặn), trừ trường hợp đổi tên gian hàng (gateway chặn theo `iat`).

---

### 4.3 Người dùng & phân quyền

**1. API**

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/users?q=&page=0&size=20` | `user.manage` | tìm theo username/họ tên (không dấu)/SĐT; sort username; size 1–100 (`id/user/UserController.java:45-50`, `id/user/UserService.java:52-58`) |
| GET | `/api/users/lookup` | đăng nhập | `[{id, fullName, username}]` user active, sort họ tên — ô chọn "Người nhập/Người tạo" (`UserController.java:52-57`) |
| GET | `/api/users/{id}` | `user.manage` | |
| POST | `/api/users` | `user.manage` | tạo (201) |
| PUT | `/api/users/{id}` | `user.manage` | sửa |
| POST | `/api/users/{id}/reset-password` `{password}` | `user.manage` | 204 |
| POST | `/api/users/{id}/2fa/reset` `{password?, code?}` | `user.manage` | 204 |
| GET | `/api/roles` | đăng nhập | danh sách vai trò + username active (`id/role/RoleController.java:37-40`) |
| POST/PUT/DELETE | `/api/roles[/{id}]` | `user.manage` | (`:42-59`) |

**2. Dữ liệu**
- `roles(id, code UNIQUE, name, system, description)`, `role_permissions(role_id, permission)` (`mig/V1__init_identity_schema.sql:13-24`, `mig/V2__settings_and_role_description.sql:9`).
- Vai trò hệ thống seed (system=true): `ADMIN` Quản trị hệ thống, `MANAGER` Quản lý điểm tiêm, `RECEPTIONIST` Tiếp đón, `DOCTOR` Bác sĩ khám sàng lọc, `NURSE` Điều dưỡng tiêm, `CASHIER` Thu ngân, `STOREKEEPER` Thủ kho (`mig/V1__init_identity_schema.sql:58-65`). Migration không seed `role_permissions` cho vai trò ngoài ADMIN (ADMIN được bơm quyền lúc khởi động).
- Vai trò tự tạo: mã `CUSTOM_` + 8 ký tự đầu UUID viết hoa (`id/role/RoleService.java:44-48`).
- Tìm kiếm không dấu: hàm `immutable_unaccent` + chỉ mục GIN trigram trên `users.full_name`, `hr_employees.name` (`mig/V10__accent_insensitive_search.sql:5-13`).

**3. Quy tắc**
- Tạo user (`id/user/UserDtos.java:19-26`, `id/user/UserService.java:71-87`): username `^[a-zA-Z0-9._-]{3,50}$`, lưu chữ thường; trùng (không phân biệt hoa thường) → 409 `USERNAME_EXISTS`; mật khẩu 8–100; họ tên ≤150; SĐT ≤20; `roleId` bắt buộc (không có → 400 `ROLE_NOT_FOUND`); ≥1 chi nhánh ("Chọn ít nhất 1 chi nhánh"), id lạ → 400 `BRANCH_NOT_FOUND`.
- Sửa user (`UserService.java:89-111`): không tự khóa mình → 400 `CANNOT_LOCK_SELF`; chủ gian hàng không bị khóa/đổi khỏi ADMIN → 400 `OWNER_PROTECTED` ("Chuyển nhượng gian hàng trước"); khóa → thu hồi refresh token. Username không đổi được.
- Đặt lại 2FA user khác (`id/user/UserTwoFactorResetService.java:18-77`): không cho chính mình (400 `CANNOT_RESET_SELF`); đích là chủ gian hàng → 403 `OWNER_PROTECTED`; đích ADMIN mà người làm không ADMIN → 403 `ADMIN_PROTECTED`; đích chưa bật → 400 `TOTP_NOT_ENABLED`; người làm xác nhận bằng mật khẩu/mã của mình → xóa TOTP+mã khôi phục đích, thu hồi mọi phiên đích, gửi thông báo riêng type `TWO_FACTOR_RESET` "Xác thực 2 lớp của bạn đã được đặt lại", ghi Lịch sử thao tác.
- Vai trò (`id/role/RoleService.java:16-100`): tên ≤100 bắt buộc, mô tả ≤500; quyền ngoài `Permissions.ALL` → 400 `INVALID_PERMISSION`; `ADMIN` chỉ đổi tên/mô tả (quyền luôn đủ); vai trò system không xóa (400 `ROLE_SYSTEM`); đang gán cho tài khoản (kể cả đã khóa) → 400 `ROLE_IN_USE` "Vai trò đang được gán cho N tài khoản..."; danh sách: system trước rồi theo tên.
- Lịch sử thao tác tính năng "Người dùng": Tạo / Sửa / Đặt lại mật khẩu / Đặt lại xác thực 2 lớp / Tạo vai trò / Sửa vai trò / Xóa vai trò.

**Danh mục quyền** (`id/role/Permissions.java:14-43`; JWT claim `perms`)

| Quyền | Nhóm | Bảo vệ (identity, thấy trong code) |
|---|---|---|
| `user.manage` | Thiết lập | `/api/users/**` (trừ lookup), ghi `/api/roles`, `/api/audit-logs/**` |
| `branch.manage` | Thiết lập | POST/PUT `/api/branches` |
| `settings.manage` | Thiết lập | PUT `/api/settings/{store,sales,customer,lock,tax}`, PUT/DELETE `/api/print-templates/{type}`, `/api/announcements/**`, PUT `/api/notifications/settings`; xem/sửa Hồ sơ cửa hàng (cùng chủ gian hàng) |
| `catalog.view` / `catalog.manage` | Danh mục hàng/gói/bảng giá | (dùng ở product-service) |
| `inventory.view` / `inventory.manage` | Kho | (product-service) |
| `patient.view` / `patient.manage` | Khách hàng & hồ sơ tiêm | (sales-service) |
| `reception.perform`, `screening.perform`, `injection.perform` | Quy trình tiêm | (các service khác) |
| `sales.perform`, `sales.cancel` | Thu ngân | (sales-service) |
| `cashbook.manage` | Sổ quỹ | (sales-service) |
| `report.view` | Báo cáo | (sales/product-service) |
| `hr.manage` | Nhân viên | toàn bộ `/api/hr/**` trừ `/api/hr/clock/**` (chấm công điện thoại: chỉ cần đăng nhập) |
| `internal` | nội bộ | chỉ JWT service-to-service; `/internal/**` |

- Thông báo lọc theo quyền: cột `notifications.permission` so với `perms` của người xem (mục 4.10).

**5. Giới hạn**
- Không xóa user (chỉ khóa). Đổi chi nhánh/quyền không cập nhật JWT đang dùng.
- `GET /api/roles` mở cho mọi user đăng nhập (trả cả username).

---

### 4.4 Chi nhánh

**1. API** (`id/branch/BranchController.java:20-47`): `GET /api/branches` (mọi user đăng nhập), `POST` (201) và `PUT /{id}` cần `branch.manage`. **Không có DELETE**.

**2. Dữ liệu**: `branches(id, code UNIQUE ≤20, name ≤200, address ≤500, phone ≤20, active, created_at, province, ward, province_code(2), ward_code(5))` (`mig/V1__init_identity_schema.sql:2-10`, `mig/V6__branch_admin_unit.sql:2-4`). Seed `CN001` "Điểm tiêm trung tâm" id `...0001` (`mig/V1:55-56`).

**3. Quy tắc** (`id/branch/BranchService.java:13-66`, `id/branch/BranchModels.java:16-37`)
- Mã: trim + viết hoa; trùng → 409 `BRANCH_CODE_EXISTS`; **mã bất biến** sau khi tạo (service khác lưu mã trên chứng từ).
- Mã tỉnh `([0-9]{2})?` / phường-xã `([0-9]{5})?` (ĐVHC 2 cấp sau 01/07/2025); rỗng → NULL (`common/address/AdminUnitCodes.java:3-28`).
- Không tìm thấy → 404 `BRANCH_NOT_FOUND`. Danh sách sort theo mã, kèm `userCount` = số user **active** gán chi nhánh (`id/branch/BranchUserCountRepository.java:20-26`).
- Không ghi Lịch sử thao tác cho chi nhánh (không gọi audit).

**5. Giới hạn**: không xóa; ngừng hoạt động bằng `active=false`.

---

### 4.5 Thiết lập cửa hàng (app_settings)

**1. API** (`id/settings/SettingsController.java:26-156`)

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/settings` → `{store, sales, customer, lock, accessCode}` | đăng nhập (đọc được cả khi bảo lưu) |
| PUT | `/api/settings/store` | `settings.manage` |
| PUT | `/api/settings/sales` | `settings.manage` |
| PUT | `/api/settings/customer` | `settings.manage` |
| PUT | `/api/settings/lock` | `settings.manage` |
| GET/PUT | `/api/settings/tax` | GET đăng nhập / PUT `settings.manage` |
| GET | `/internal/settings`, `/internal/settings/tax` | `internal` |

**2. Dữ liệu**: `app_settings(key VARCHAR(50) PK, value JSONB, updated_by, updated_at)`; khóa chưa có dòng → mặc định (`mig/V2__settings_and_role_description.sql:2-7`, `id/settings/SettingsRepository.java:12-70`).

**Danh mục khóa app_settings**

| Khóa | Kiểu / nội dung | Mặc định | Ghi bởi |
|---|---|---|---|
| `store` | `StoreInfo{name*, phone, email, address, province, ward, taxCode, logo, accessCode, provinceCode, wardCode}` | null → tên "VaxClinic", accessCode `vaxclinic` | PUT /settings/store, Hồ sơ cửa hàng |
| `sales` | `{allowNegativeStock, blockEditPublishedEInvoice, lockTransactionTime, returnLimitDays}` | `false, true, false, null` (`common/settings/ShopSettings.java:22-26`) | PUT /settings/sales |
| `customer` | `{requiredFields[], debtLimit}` | `[]`, null | PUT /settings/customer |
| `lock` | `{enabled, branches{branchId→date}}` | `false, {}` | PUT /settings/lock |
| `tax` | TaxSettings (mục 4.8) | `DEFAULT` | PUT /settings/tax |
| `notification` | `{expiryAlertDays}` | 30 (`common/notification/NotificationClient.java:31-32`) | PUT /notifications/settings |
| `print:{TYPE}` | `{html}` | không có → mẫu mặc định FE | /print-templates |
| `owner_profile` | OwnerProfile | rỗng | Hồ sơ cửa hàng |
| `store_pause` | `{pausedOn, reopenOn, reopenedAt, pausedBy}` | null | bảo lưu |
| `session_cutoff` | `{notBefore}` (epoch giây) | 0 | đổi tên gian hàng |
| `hr.timekeeping`, `hr.payroll`, `hr.workdays`, `hr.holidays`, `hr.mobile`, `hr.templates` | thiết lập HR (mục 4.13) | `defaults()` / `[]` | /api/hr/settings |

**3. Quy tắc**
- `store` (`SettingsController.java:35-47, :90-107`): tên bắt buộc ≤200, phone ≤20, email hợp lệ ≤150, address ≤500, taxCode ≤20; `logo` ≤400.000 ký tự và phải là `data:image/...` (thu nhỏ phía trình duyệt) → sai 400 `INVALID_LOGO`; `accessCode` `[a-z0-9]{3,40}`; gửi accessCode khác mã hiện tại → 400 `ACCESS_CODE_LOCKED` ("Đổi địa chỉ truy cập tại Hồ sơ cửa hàng → Cập nhật → Đổi tên gian hàng"); luôn ghi tường minh mã đang dùng để đổi tên cửa hàng không đổi địa chỉ tự sinh.
  - Địa chỉ truy cập tự sinh (`id/settings/StoreAccessController.java:27-38`): bỏ dấu, đ→d, chữ thường, chỉ giữ `[a-z0-9]`, cắt 40; < 3 ký tự hoặc chưa có `store` → `vaxclinic`. `GET /api/auth/store?code=` so sánh không phân biệt hoa thường, sai → 404 `STORE_NOT_FOUND`; chỉ trả tên + logo.
- `sales` (`SettingsController.java:49-50, :109-119`): `returnLimitDays` 1–3650 hoặc null (= không giới hạn trả hàng). Ý nghĩa: bán khi hết tồn; chặn sửa/hủy HĐ đã phát hành HĐĐT; khóa thời gian giao dịch; giới hạn ngày trả hàng (áp dụng ở sales/product-service).
- `customer` (`:121-135`): trường bắt buộc ⊂ {`phone, email, gender, birthday, address, facebook, group`} → ngoài danh sách 400 `INVALID_FIELD`; `debtLimit` ≥ 0 (âm → 400 `INVALID_DEBT_LIMIT`), null = không cảnh báo nợ.
- Mỗi PUT ghi Lịch sử thao tác "Thiết lập cửa hàng / Sửa" kèm mô tả giá trị.
- **Cache/polling ở service khác** (`common/settings/ShopSettingsClient.java:15-100`): đọc `/internal/settings` bằng JWT nội bộ, TTL **30 giây**; `cached()` không bao giờ gọi HTTP trên luồng hiện tại, làm mới nền mỗi **10 giây**; identity không phản hồi → dùng bản gần nhất, chưa có → `ShopSettings.DEFAULT` (để quầy vẫn bán được). ⇒ đổi thiết lập có hiệu lực ở service khác sau tối đa ~30 giây.
- JWT nội bộ: subject `service:{name}`, perms `["internal"]`, TTL 10 phút, cache 8 phút (`common/security/ServiceTokenProvider.java:28-44`).

**5. Giới hạn**: `/internal/settings` chỉ trả `sales/customer/lock` (không có `store`, `tax` riêng endpoint).

---

### 4.6 Khóa sổ

- Lưu khóa `lock` = `BookLock{enabled, branches: {branchId → lockDate}}` (`common/settings/ShopSettings.java:40-47`).
- PUT `/api/settings/lock` (`settings.manage`): ngày khóa null hoặc **sau hôm nay** (giờ VN) → 400 `INVALID_LOCK_DATE` "Ngày khóa sổ không được sau ngày hôm nay" (`id/settings/SettingsController.java:137-147`).
- Áp dụng (các service gọi `checkNotLocked(branchId, documentTime)`): chứng từ có ngày (giờ VN) **≤ ngày khóa** của chi nhánh → 400 `BOOK_LOCKED` "Sổ đã khóa đến ngày dd/MM/yyyy: không được tạo, sửa hoặc hủy giao dịch từ ngày này trở về trước" (`common/settings/ShopSettings.java:57-65`). Chi nhánh không có trong map hoặc `enabled=false` → không khóa.
- Lan truyền qua cache 30 giây (mục 4.5).

---

### 4.7 Mẫu in

**1. API** (`id/settings/PrintTemplateController.java:20-54`): `GET /api/print-templates` (đăng nhập) → `{TYPE: html}` chỉ gồm mẫu đã sửa; `PUT /{type}` `{html}` và `DELETE /{type}` (đặt lại mặc định) cần `settings.manage`.

**2. Dữ liệu**: khóa `print:{TYPE}` trong `app_settings` (`id/settings/PrintTemplateService.java:13-62`).

**3. Quy tắc**
- Loại hợp lệ: `INVOICE, SALES_RETURN, CASH_RECEIPT, CASH_PAYMENT, PURCHASE_RECEIPT, PURCHASE_RETURN, DELIVERY_INVOICE` (hóa đơn giao hàng); khác → 400 `INVALID_TEMPLATE_TYPE` (`PrintTemplateService.java:20-21, :57-62`).
- HTML bắt buộc, ≤ 200.000 ký tự (`PrintTemplateController.java:28`). Backend **không** lọc HTML; trình duyệt lọc script trước khi in (`:20-22`).
- Ghi Lịch sử thao tác "Mẫu in" / Sửa | Đặt lại.
- Placeholder, mẫu mặc định, `sanitizeHtml`: xem mục 4.16 (frontend).

---

### 4.8 Thuế & Kế toán (phương pháp GTGT, ngành nghề)

**1. API**: `GET /api/settings/tax` (đăng nhập), `PUT /api/settings/tax` (`settings.manage`), `GET /internal/settings/tax` (cho sales-service tính "Giảm thuế") (`id/settings/TaxSettingsController.java:93-161`).

**2. Dữ liệu** (khóa `tax`)
- `TaxSettings{vatEnabled, sectors[], defaultSector, categorySectors{categoryId→sectorCode}, defaultTaxCode ≤30, profiles[], vatMethod}` (`:65-73`).
- `Sector{code ≤30, name ≤200, vatRate 0–20, pitRate 0–20}` (%) (`:53-56`).
- `TaxProfile{taxCode, name ≤200, revenueGroup 1–4, pitMethod REVENUE|PROFIT, active, locations[]}`; MST regex `\d{10}(-?\d{3})?|\d{12}` ("10, 12 hoặc 13 chữ số"); nhóm doanh thu 1: ≤1 tỷ/năm, 2: >1–3 tỷ, 3: >3–50 tỷ, 4: >50 tỷ (`:45-50`).
- `Location{code ≤10, name ≤200, address ≤300, province, ward, branchIds[], startDate, active, provinceCode, wardCode}` (`:38-43`).

**Mặc định** (`:75-83`)

| Mã ngành | Tên | GTGT % | TNCN % |
|---|---|---|---|
| `PHAN_PHOI` | Phân phối, cung cấp hàng hóa | 1 | 0.5 |
| `SAN_XUAT` | Sản xuất, vận tải, dịch vụ có gắn với hàng hóa | 3 | 1.5 |
| `DICH_VU` | Dịch vụ, xây dựng không bao thầu nguyên vật liệu | 5 | 2 |
| `CHO_THUE` | Cho thuê tài sản, đại lý, nội dung số | 5 | 5 |
| `KHAC` | Hoạt động kinh doanh khác | 2 | 1 |

- `DEFAULT = (vatEnabled=true, sectors trên, defaultSector="SAN_XUAT", {}, defaultTaxCode="HKD_KCT_15", profiles=[], vatMethod="DEDUCTION")`.
- `vatMethod`: `DEDUCTION` (khấu trừ, mặc định) | `DIRECT` (trực tiếp trên doanh thu theo % ngành) — quyết định cách "Giảm thuế" (NQ 204/2025/QH15) ở màn bán hàng (`:58-64`). Bản lưu cũ thiếu → `DEDUCTION`; thiếu danh sách ngành → dùng mặc định (`:93-105`).
- Nhóm hàng con chưa gắn ngành theo nhóm cha; hàng thuộc nhóm chưa gắn → `defaultSector`; dòng hàng chưa có mã thuế → `defaultTaxCode` (`:58-62`).

**3. Quy tắc lưu** (`:114-161`)
- ≥1 ngành (400 `SECTOR_REQUIRED`); mã ngành trùng → 400 `SECTOR_DUPLICATED`; `defaultSector` không có → 400 `SECTOR_NOT_FOUND`; nhóm hàng gắn ngành đã xóa → 400 `SECTOR_NOT_FOUND`.
- MST trùng → 400 `TAX_CODE_DUPLICATED`; mã địa điểm trùng trong 1 MST → 400 `LOCATION_CODE_DUPLICATED`.
- 1 chi nhánh chỉ thuộc 1 địa điểm **đang hoạt động** của MST đang hoạt động → 400 `BRANCH_IN_TWO_LOCATIONS` (tránh tính doanh thu 2 lần).
- Ghi Lịch sử thao tác "Thuế & Kế toán / Sửa".

---

### 4.9 Nhật ký thao tác (Lịch sử thao tác)

**1. API** (`id/audit/AuditLogController.java:22-68`)
- `POST /internal/audit-logs` (`internal`) — các service gửi lô sự kiện.
- `GET /api/audit-logs?userId=&feature=&from=&to=&q=&page=&size=` (`user.manage`).
- `GET /api/audit-logs/export` (`user.manage`) → `lich-su-thao-tac.csv`.
- `GET /api/audit-logs/features` (`user.manage`) → danh sách tính năng distinct.

**2. Dữ liệu**: `audit_logs(id BIGSERIAL, occurred_at, user_id, user_name ≤150, branch_id, feature ≤50, action ≤30, doc_code ≤50, detail ≤1000)`, index theo thời gian & user (`mig/V3__audit_logs.sql:2-14`); giá trị dài bị cắt khi ghi (`id/audit/AuditLogRepository.java:34-46`).

**3. Quy tắc / 4. Lọc-xuất**
- Lọc: `userId`, `feature` (khớp đúng), `from`/`to` theo ngày giờ VN (to bao gồm cả ngày), `q` ILIKE trên `doc_code` hoặc `detail` (thoát `%`/`_`); mới nhất trước; `size` tối đa 200 (`AuditLogRepository.java:80-106`, `id/audit/AuditLogService.java:18-38`).
- CSV: UTF-8 có BOM, cột `Nhân viên, Tính năng, Thao tác, Mã chứng từ, Thời gian (dd/MM/yyyy HH:mm:ss), Chi tiết`, tối đa **50.000** dòng; mọi ô bọc nháy kép; ô bắt đầu `= + - @` thêm `'` (chống CSV injection) (`AuditLogService.java:40-64`).
- Tính năng ghi trong identity: "Tài khoản", "Người dùng", "Thiết lập cửa hàng", "Mẫu in", "Thuế & Kế toán", "Thông báo nội bộ", "Hồ sơ cửa hàng", "Nhân viên" (+ HR feature khác nếu có, mục 4.13).

**5. Giới hạn**: `page` không bị chặn trên; tổng đếm `count(*)` toàn bộ mỗi lần.

---

### 4.10 Thông báo (Hộp thư đến) & thông báo nội bộ

**1. API**
- `GET /api/notifications?tab=all|alert|update&page&size` (size ≤100), `GET /api/notifications/unread-count` → `{count, alert, update}`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all?tab=` → `{marked}` — mọi user đăng nhập (`id/notification/NotificationController.java:48-68`).
- `GET /api/notifications/settings` (đăng nhập) / `PUT` (`settings.manage`) `{expiryAlertDays 1–365}` (`:35-81`).
- Nội bộ (`internal`): `GET /internal/notifications/settings`, `POST /internal/notifications` (upsert), `POST /internal/notifications/sync {types, items}`, `POST /internal/notifications/resolve [dedupeKeys]` (`:85-113`).
- Thông báo nội bộ: `GET/POST /api/announcements`, `PUT/DELETE /api/announcements/{id}` — `settings.manage` (`id/notification/AnnouncementController.java:25-54`).

**2. Dữ liệu**: `notifications(id, category ALERT|UPDATE, type (LOT_EXPIRING, LOW_STOCK, ORDER_DUE, ANNOUNCEMENT, TWO_FACTOR_RESET...), dedupe_key, title ≤300, body, doc_code, link ≤500, branch_id (NULL=mọi CN), permission (NULL=mọi người), created_by, created_by_name, created_at, updated_at, resolved_at, target_user_id)`; `notification_reads(notification_id, user_id, read_at)` (`mig/V7__notifications.sql:3-30`, `mig/V9__notification_target_user.sql:2-3`).

**3. Quy tắc**
- Hiển thị (`id/notification/NotificationQueryRepository.java:26-31`): `resolved_at IS NULL` **và** (branch null hoặc ∈ `branches` JWT) **và** (permission null hoặc ∈ `perms` JWT) **và** (target_user null hoặc = user). Đã đọc tính theo từng user.
- Upsert cảnh báo theo `dedupeKey` (`id/notification/NotificationWriter.java:15-51`): bỏ qua item thiếu key/title; chưa có → tạo; bản mới nhất đang mở **hoặc** tạo trong hôm nay → cập nhật nội dung + mở lại (giữ trạng thái đã đọc; không đụng nếu nội dung không đổi) → tối đa 1 cảnh báo/đối tượng/ngày; còn lại → tạo mới.
- `sync`: upsert item thuộc `types` rồi đóng các cảnh báo cùng loại không còn trong danh sách (`:53-60`, `NotificationWriteRepository.java:48-53`).
- Dọn hằng ngày (trễ 2 phút sau khởi động): xóa ALERT đã đóng > 30 ngày hoặc tạo > 90 ngày; thông báo nội bộ giữ lại (`NotificationWriter.java:67-71`, `NotificationWriteRepository.java:60-65`).
- Thông báo riêng 1 user: ALERT, không gộp theo dedupe (`:73-76`).
- Thông báo nội bộ (`id/notification/AnnouncementService.java:12-76`, `AnnouncementModels.java:14-17`): tiêu đề bắt buộc ≤300, body ≤5000, link ≤500 chỉ nhận `/...` (không `//`) hoặc `http(s)://` → khác 400 `INVALID_LINK`; không tìm thấy → 404 `ANNOUNCEMENT_NOT_FOUND`; sửa giữ trạng thái đã đọc; category `UPDATE`, mọi người thấy; ghi Lịch sử thao tác "Thông báo nội bộ".
- `expiryAlertDays` (mặc định 30): số ngày cảnh báo lô sắp hết hạn, các service đọc qua `/internal/notifications/settings`.

---

### 4.11 Hồ sơ cửa hàng (thông tin gian hàng, chủ gian hàng, đổi tên, chuyển nhượng, bảo lưu)

**1. API** (`id/storeprofile/StoreProfileController.java:29-106`) — tất cả dưới `/api/store-profile` (gateway cho qua khi bảo lưu):

| Method | Path | Ai | Mô tả |
|---|---|---|---|
| GET | `` | chủ GH hoặc `settings.manage` | `ProfileView` |
| POST | `/verify` `{purpose, password?, code?}` | theo purpose | → `{verifyToken, expiresAt}` |
| PUT | `/profile` | manager + token PROFILE | hồ sơ chủ |
| PUT | `/phone` | manager + token PHONE | SĐT |
| GET | `/history?page&size` | manager | tab "Lịch sử cập nhật" (size ≤100) |
| PUT | `/access-code` `{accessCode, verifyToken}` | chủ GH + RENAME | đổi tên gian hàng |
| GET | `/transfer-candidates` | chủ GH | ADMIN active khác |
| POST | `/transfer` `{targetUserId, verifyToken}` | chủ GH + TRANSFER | |
| POST | `/pause` `{reopenOn, verifyToken}` | chủ GH + PAUSE | |
| POST | `/reopen` | chủ GH | mở lại sớm |
| * | `/einvoice/**`, `/certificates/**` | — | route sang **integration-service** (ngoài phạm vi identity; mục 4.12) |

**2. Dữ liệu**: khóa `owner_profile` = `OwnerProfile{businessType PERSONAL|HOUSEHOLD|ENTERPRISE, birthDate, representative, idNumber, idIssueDate, idIssuePlace, gender MALE|FEMALE}`; email/phone/address/province/ward dùng chung khóa `store`; `store_pause`; `session_cutoff` (`id/storeprofile/StoreProfileModels.java:16-40`). `ProfileView` gồm thêm `storeName, accessCode, industry="Tiêm chủng", branchCount (active), status, owner, isOwner, twoFactorEnabled` (`:84-90`, `StoreProfileService.java:109-118`).

**3. Quy tắc**
- Quyền (`id/storeprofile/StoreProfileAccess.java:12-45`): manager = chủ GH **hoặc** `settings.manage` (khác → 403 `FORBIDDEN`); owner-only → 403 `OWNER_ONLY`.
- Phiếu xác thực (`id/storeprofile/StoreActionVerifier.java:20-60`): purpose `PROFILE|PHONE|RENAME|TRANSFER|PAUSE`; RENAME/TRANSFER/PAUSE cần chủ GH, PROFILE/PHONE cần manager (`StoreProfileService.java:70-74`); xác nhận bằng mã 2FA (đã bật) hoặc mật khẩu (`confirmIdentity`); token `{userId}.{purpose}.{expEpoch}.{HMAC-SHA256}` (khóa dẫn xuất từ `JWT_SECRET`), hiệu lực **10 phút**, đúng user + đúng purpose; sai/hết hạn → 400 `VERIFY_EXPIRED`. Token dùng lại được trong 10 phút (không đánh dấu đã dùng).
- Hồ sơ (`StoreProfileModels.java:42-57`): email bắt buộc hợp lệ; giới tính bắt buộc; CCCD/Hộ chiếu `[A-Za-z0-9]{8,12}`; ngày sinh quá khứ; ngày cấp ≤ hôm nay; người đại diện ≤150 & địa chỉ ≤500 bắt buộc; mã tỉnh/xã như chi nhánh.
- SĐT: `0\d{9}` (`:59-61`).
- **Đổi tên gian hàng** (`id/storeprofile/StoreOwnershipService.java:74-91`): accessCode `[a-z0-9]{3,40}`; trùng mã hiện tại (không phân biệt hoa thường) → 400 `SAME_ACCESS_CODE`; ghi `store.accessCode`, `session_cutoff = now+1s`, thu hồi **mọi** refresh token của mọi user → gateway 401 `SESSION_REVOKED` cho JWT cũ; FE chuyển về trang đăng nhập với địa chỉ mới.
- **Chuyển nhượng** (`:93-115`): người nhận là ADMIN active khác chủ hiện tại → khác 400 `INVALID_NEW_OWNER`; bỏ cờ chủ cũ trước (flush) rồi gán mới (chỉ mục duy nhất).
- **Bảo lưu** (`:117-133`): chỉ **1 lần duy nhất** (`store_pause` đã tồn tại → 409 `PAUSE_USED`); `reopenOn` phải > hôm nay và ≤ hôm nay + **60 ngày** → 400 `INVALID_PAUSE_DATE`. Đang bảo lưu khi `reopenedAt == null && today < reopenOn` — tự mở lại đúng ngày, không cần job (`id/storeprofile/StoreStatusService.java:28-37`). Trong thời gian bảo lưu gateway trả 423 cho API nghiệp vụ.
- **Mở lại sớm** (`:135-145`): không trong bảo lưu → 400 `NOT_PAUSED`; ghi `reopenedAt`.
- Mọi thay đổi ghi Lịch sử thao tác tính năng "Hồ sơ cửa hàng" (đọc lại ở tab Lịch sử cập nhật) (`StoreProfileService.java:131-133`, `id/storeprofile/StoreProfileHistoryRepository.java:9-33`).

**5. Giới hạn**: bảo lưu chỉ 1 lần trọn đời; không có OTP SMS (thay bằng mật khẩu/TOTP).

---

### 4.12 Hóa đơn điện tử (cấu hình HĐĐT) & chứng thư số trên Hồ sơ cửa hàng

- Gateway route `/api/store-profile/einvoice/**` và `/api/store-profile/certificates/**` sang **integration-service** (order -1, khớp trước identity) (`gw/resources/application.yml:21-26`). Identity-service **không** có controller cho 2 nhánh này; lưu trữ/mã hóa bí mật nằm ở integration-service (ngoài phạm vi phần này — xem tài liệu integration).
- Khi bảo lưu, path `/api/store-profile**` vẫn được gateway cho qua (`gw/java/com/vaxclinic/gateway/StoreStatusFilter.java:71-74`) ⇒ cấu hình HĐĐT/chứng thư vẫn truy cập được lúc bảo lưu.
- Bí mật do identity tự giữ (chỉ tên biến): khóa TOTP mã hóa AES-256-GCM trong `user_totp.secret_enc`, khóa dẫn xuất từ `ENCRYPTION_KEY` (fallback `JWT_SECRET`); mã khôi phục chỉ lưu HMAC; refresh token chỉ lưu SHA-256; khóa QR chấm công dẫn xuất từ `ENCRYPTION_KEY`; phiếu xác thực Hồ sơ cửa hàng ký bằng khóa dẫn xuất từ `JWT_SECRET` (`id/auth/twofactor/TotpSecretCipher.java:17-34`, `id/hr/clock/ClockTokenService.java:15-33`, `id/storeprofile/StoreActionVerifier.java:28-36`).

---

### 4.13 Nhân viên / HR

Mọi API `/api/hr/**` cần `hr.manage`, **trừ** `GET /api/hr/clock/me` và `POST /api/hr/clock` (chỉ cần đăng nhập) (`id/hr/clock/ClockController.java:34-50`). Lịch sử thao tác: tính năng "Nhân viên" (mặc định, `id/hr/HrActor.java:15`), "Bảng lương" cho bảng lương.

#### 4.13.1 Hồ sơ nhân viên, phòng ban, chức danh

**API**
- `GET /api/hr/employees?status=&departmentId=&jobTitleId=&branchId=&q=&page=0&size=20` (size 1–500; sort `code desc`) (`id/hr/employee/EmployeeController.java:45-54`, `EmployeeService.java:65-99`).
- `GET/PUT/DELETE /api/hr/employees/{id}`, `POST /api/hr/employees` (201).
- `GET /api/hr/employees/{id}/advances`, `POST /api/hr/employees/{id}/advances` (tạm ứng).
- `GET/POST /api/hr/{departments|job-titles}`, `PUT/DELETE /api/hr/{departments|job-titles}/{id}` (`id/hr/employee/HrCatalogController.java:43-63`).

**Dữ liệu** (`mig/V4__hr_schema.sql:4-72`, `mig/V5__hr_employee_end_date.sql:2`)
- `hr_employees(id, code UNIQUE, timekeeping_code UNIQUE, name, phone, id_number, birthday, gender, start_date, end_date, main_branch_id, department_id, job_title_id, user_id UNIQUE→users, status WORKING|QUIT, note, salary_type SHIFT|HOUR|STANDARD_DAY|FIXED, salary_amount NUMERIC(18,0), overtime_percent NUMERIC(6,2) default 150, commission_table_id ON DELETE SET NULL)`.
- `hr_employee_branches`, `hr_employee_pay_items(item_type ALLOWANCE|DEDUCTION, name, kind, amount ≥0)`; `hr_departments(name UNIQUE)`, `hr_job_titles(name UNIQUE)`.
- Mã NV: `NV%06d` từ sequence `hr_employee_code_seq` khi để trống (`EmployeeService.java:113-116`).

**Quy tắc** (`id/hr/employee/EmployeeDtos.java:22-44`, `EmployeeService.java:109-159`)
- Mã ≤20 `[A-Za-z0-9_.-]*`, lưu viết hoa; sửa mà để trống → giữ mã cũ. Mã chấm công ≤30; tên bắt buộc ≤150; giới tính `MALE|FEMALE`; status `WORKING|QUIT` (mặc định WORKING); salaryType như trên hoặc null (= chưa thiết lập lương); salaryAmount ≥0 (mặc định 0); overtimePercent 0–1000 (mặc định 150).
- Chi nhánh chính = `mainBranchId` hoặc chi nhánh đầu trong `branchIds`; luôn được thêm vào danh sách chi nhánh làm việc.
- `endDate < startDate` → 400 `INVALID_END_DATE`.
- Trùng khóa → 409 `EMPLOYEE_DUPLICATE`: "Mã chấm công đã được dùng cho nhân viên khác" / "Tài khoản đã được liên kết với nhân viên khác" (1 user ↔ tối đa 1 NV) / "Mã nhân viên đã tồn tại".
- Phụ cấp kind `DAY|MONTH`, giảm trừ kind `LATE|EARLY|MONTH` (thiếu kind → `MONTH`); sai → 400 `INVALID_PAY_ITEM`. Lưu lại toàn bộ (xóa rồi chèn) mỗi lần sửa.
- Xóa: có chấm công / phiếu lương / tạm ứng → 400 `EMPLOYEE_IN_USE` ("hãy chuyển sang trạng thái Đã nghỉ") (`EmployeeService.java:54-63`, `EmployeeRepository.java:23-29`); xóa cascade chi nhánh/phụ cấp/lịch.
- Lọc: status, phòng ban, chức danh, chi nhánh (chính hoặc làm việc), `q` trên mã, tên (không dấu), mã chấm công, SĐT.
- Cột `debt` ("Nợ và tạm ứng") = Σ ADVANCE − Σ DEDUCT chưa hủy (`EmployeeProfileRepository.java:24-26`).
- Phòng ban/chức danh (`id/hr/employee/HrCatalogService.java:14-70`): tên ≤100 không trùng (409 `NAME_EXISTS`); danh sách kèm số NV; xóa → bỏ gán khỏi NV rồi xóa.

#### 4.13.2 Tạm ứng / nợ nhân viên

- `POST /api/hr/employees/{id}/advances {amount ≥1, fund CASH|BANK, branchId?, note ≤300}` (`EmployeeDtos.java:65-68`, `id/hr/employee/EmployeeAdvanceService.java:37-56`):
  - thiếu amount → 400 `INVALID_AMOUNT`; chi nhánh = branchId hoặc chi nhánh chính, không có → 400 `BRANCH_REQUIRED`;
  - ghi `hr_advances(kind=ADVANCE)`; mã phiếu chi `PCTU%06d` (sequence `hr_payment_code_seq` dùng chung với PCPL);
  - outbox → Sổ quỹ phiếu chi `sourceType=HR_ADVANCE`, category "Chi tạm ứng lương nhân viên", partnerType EMPLOYEE; Lịch sử thao tác "Tạm ứng".
- Khấu trừ khi trả lương: dòng `DEDUCT` gắn `payment_id`; hủy thanh toán → hủy khấu trừ (mục 4.13.6).
- Không có API hủy tạm ứng (cột `cancelled` chỉ đổi qua hủy thanh toán).

#### 4.13.3 Ca làm việc & lịch làm việc

**API**: `/api/hr/shifts` GET/POST/PUT/DELETE (`id/hr/schedule/ShiftController.java:28-62`); `/api/hr/schedules` `GET ?from&to`, `POST`, `DELETE /{id}?repeat=`, `POST /import` (`ScheduleController.java:28-59`).

**Dữ liệu**: `hr_shifts(name, start_time, end_time, active)` — `end ≤ start` = ca qua đêm; độ dài ca `minutes` (qua đêm +1440) (`id/hr/schedule/Shift.java:7-12`); `hr_schedules(employee_id, shift_id, work_date)` UNIQUE (`mig/V4:75-91`).

**Quy tắc**
- Ca: tên ≤100, giờ bắt đầu = kết thúc → 400 `INVALID_SHIFT`; xóa ca đã dùng (lịch/chấm công) → chỉ ngừng hoạt động (`id/hr/schedule/ShiftService.java:45-60`).
- Lưới lịch: khoảng ≤ 62 ngày → 400 `INVALID_RANGE`; trả kèm "Lương dự kiến" (`ScheduleService.java:43-48`).
- Xếp ca: nhiều NV × nhiều ca; `repeatWeekly` → lặp các thứ `weekdays` (1=T2…7=CN; trống = thứ của `date`) tới `until` (mặc định +4 tuần, tối đa 366 ngày → 400 `INVALID_REPEAT`); ca trùng bỏ qua; trả `{created}` (`:50-77`).
- Xóa: `repeat=true` → xóa cùng NV + ca + thứ từ ngày đó trở đi; không thấy → bỏ qua (`:79-89`).
- Import: tối đa 5000 dòng `{employeeCode, date, shiftName}`; mã NV không phân biệt hoa thường, tên ca (active) không phân biệt hoa thường; lỗi trả tối đa 50 dòng (`:91-111`, `ScheduleModels.java:32-36`).
- **Lương dự kiến** (`id/hr/schedule/ExpectedSalaryCalculator.java:18-82`): chỉ NV đang làm có lương; FIXED = Σ theo từng ngày (lương tháng ÷ số ngày của kỳ lương chứa ngày); STANDARD_DAY = Σ ngày (lương ngày × ngày công quy đổi từ tổng phút ca × hệ số lễ); SHIFT/HOUR = Σ ca (`shiftPay` × hệ số lễ); làm tròn đồng.

#### 4.13.4 Chấm công (lưới, sửa tay, duyệt, máy chấm công, điện thoại)

**API**: `GET /api/hr/attendance?from&to&branchId&employeeId`, `PUT /api/hr/attendance`, `DELETE /api/hr/attendance/{id}`, `POST /api/hr/attendance/approve`, `POST /api/hr/attendance/import` (multipart `file`, `branchId?`) (`id/hr/attendance/AttendanceController.java:51-71`, `MachineImportController.java:30-33`); `GET /api/hr/clock/qr?branchId` (`hr.manage`), `GET /api/hr/clock/me`, `POST /api/hr/clock {action IN|OUT, token?}`.

**Dữ liệu**: `hr_attendance(employee_id, shift_id, work_date UNIQUE, check_in, check_out, absence PAID|UNPAID, approved, source MANUAL|PHONE|MACHINE|AUTO, branch_id, note ≤300)` (`mig/V4:93-110`).

**Đánh giá ô** (`id/hr/attendance/AttendanceRules.java:13-86`)
- Trạng thái: `ABSENT` (nghỉ; PAID tính đủ phút ca, UNPAID = 0), `NOT_CHECKED` (chưa chấm), `MISSING` (thiếu vào hoặc ra / ra ≤ vào), `LATE_EARLY`, `ON_TIME`.
- Đi muộn = phút từ đầu ca tới giờ vào nếu `lateEnabled` và vào sau đầu ca + `lateAfter`; về sớm tương tự với `earlyBefore`.
- Làm thêm: vào sớm hơn đầu ca quá `otBefore` / ra muộn hơn cuối ca quá `otAfter` → tính phần vượt ngưỡng (hoặc toàn bộ nếu `otActualAll`).
- Phút làm: `hourMode=SHIFT` → chỉ phần nằm trong ca; `ACTUAL` → (ra − vào) − phút làm thêm.
- Quy đổi ngày công: `convertEnabled` → ≥ `fullFrom` phút = 1 công, ≥ `halfFrom` = 0.5, còn lại 0; tắt → phút ÷ (giờ công chuẩn × 60), tối đa 1 (4 chữ số thập phân).

**Quy tắc ghi**
- Lưới ≤ 62 ngày → 400 `INVALID_RANGE`; ô = lịch ∪ bản ghi chấm công (`id/hr/attendance/AttendanceService.java:48-53`, `AttendanceQuery.java:13-41`).
- Sửa tay (`AttendanceService.java:55-78`): ca không có → 404 `SHIFT_NOT_FOUND`; NV không có → 404 `EMPLOYEE_NOT_FOUND`; nghỉ thì bỏ giờ; ca qua đêm: giờ vào trước (giờ bắt đầu − 4h) / giờ ra trước giờ bắt đầu → sang ngày hôm sau; ra ≤ vào → +1 ngày; source `MANUAL`; có thể đánh dấu `approved` ngay.
- Ghi chung: ra ≤ vào → 400 `INVALID_TIME` (`AttendanceWriter.java:82-96`).
- Duyệt (`AttendanceService.java:86-97`): ô chưa duyệt, đủ vào+ra hoặc nghỉ, trong `[from,to]` (+ chi nhánh / danh sách id) → `approved=true`; **chỉ ô đã duyệt được tính lương**.
- Ghép giờ quét vào ca (`AttendanceWriter.java:18-76`): ứng viên = ca đã xếp hôm qua + hôm nay có khung [đầu ca − 4h, cuối ca + 4h] chứa giờ quét; không có và bật `allowUnscheduled` → mọi ca active của hôm nay/hôm qua; chọn ca gần nhất. Ô đã duyệt hoặc nghỉ không bị ghi đè; vào = sớm nhất, ra = muộn nhất.
- **File máy chấm công** (`MachineImportService.java:27-118`, `MachineLogFormat.java:13-92`, `SpreadsheetReader.java:27-40`): CSV/TXT/XLSX (`.xls` → 400 `UNSUPPORTED_FILE`; entry XLSX > 40 MB → 400 `FILE_TOO_LARGE`; rỗng → 400 `EMPTY_FILE`; đọc lỗi → 400 `INVALID_FILE`); multipart ≤ 10 MB (`backend/identity-service/src/main/resources/application.yml:17-20`). Nhận cột theo tiêu đề không dấu (mã: "cham cong", "ac-no", "enroll", "id", "user id", "ma nv", "no."; thời gian: "thoi gian", "datetime", "ngay gio", "check time"; hoặc "ngay"/"date" + "gio"/"time"); không nhận ra → cột 0 = mã, cột 1 = thời gian. Thời gian: 10 định dạng d/M/yyyy, yyyy-M-d, ISO..., số ngày Excel, AM/PM, SA/CH. Mã chấm công so khớp bỏ số 0 đầu, chỉ NV đang làm. 1 lượt quét trong ca (hoặc các lượt cách ≤ 60 giây) → gần đầu ca = giờ vào, gần cuối ca = giờ ra. Trả `{rows, punches, records, unknownCodes, unmatched, errors(≤20)}`; source `MACHINE`.
- **Chấm công điện thoại** (`id/hr/clock/ClockService.java:22-95`, `PhoneClockService.java:19-95`):
  - Tài khoản phải liên kết NV đang làm (400 `NOT_EMPLOYEE`); `hr.mobile.enabled=false` → 400 `MOBILE_DISABLED`.
  - Có token hoặc `requireQr` → kiểm QR: sai/hết hạn 400 `QR_INVALID`, thiếu 400 `QR_REQUIRED`; NV không thuộc chi nhánh của QR → 400 `WRONG_BRANCH`.
  - QR token `{branchId}.{slot}.{HMAC16B}`, slot = epoch/60; chỉ nhận slot hiện tại hoặc liền trước (tuổi ≤ ~2 phút); màn quầy làm mới mỗi 60 giây (`ClockTokenService.java:15-75`).
  - IN: ca phù hợp (không có → 400 `NO_SHIFT`); đã có giờ vào → 400 `ALREADY_IN`; ô đã duyệt/nghỉ → 400 `LOCKED`.
  - OUT: ca đang mở gần nhất (hôm qua/hôm nay, chưa duyệt, có vào chưa ra); không có → ghi giờ ra vào ca phù hợp ("chưa có giờ vào ca"); `singleInOutMultiShift` → ca liền kề (bắt đầu = kết thúc ca trước, đã bắt đầu) tự đóng ca trước ở giờ kết thúc và mở ca sau ở giờ bắt đầu.
  - source `PHONE`; Lịch sử thao tác "Chấm công".
- **Tự động chấm công** (`id/hr/HrJobs.java:70-87`): nếu `autoTimekeeping`, mỗi giờ (trễ 90 giây sau khởi động): ca đã xếp 3 ngày gần nhất của NV đang làm, đã kết thúc mà chưa có bản ghi → ghi đúng giờ ca, source `AUTO`, **chưa duyệt**.

#### 4.13.5 Bảng lương

**API** (`id/hr/payroll/PayrollController.java:34-136`): `GET /api/hr/payrolls?statuses=&q=&page=0&size=15` (size ≤100, lọc trạng thái + `q` ILIKE mã/tên, sort `period_start desc, code desc`, kèm `sumTotal/sumPaid/sumRemaining`) (`PayrollQueryRepository.java:53-72`); `GET /{id}` (bảng + phiếu lương kèm `advance_balance` + lịch sử thanh toán); `POST` `{name ≤150, periodStart, periodEnd, branchId}`; `POST /{id}/recalculate`, `/{id}/lock`, `/{id}/cancel`; `PUT /{id}/payslips/{slipId} {bonus ≥0}`; `POST /{id}/payments`; `POST /payments/{paymentId}/cancel`.

**Dữ liệu**: `hr_payrolls(code BL%06d, name, pay_cycle MONTHLY, period_start, period_end, branch_id, status, total, paid, note, created_by(_name), created_at, computed_at, locked_at)`; `hr_payslips(... work_units, base_amount, overtime_amount, holiday_amount, allowance, commission, bonus, deduction, insurance, tax, total, paid, details JSONB)`; `hr_payroll_payments(code PCPL%06d, cash_amount, advance_amount, method CASH|BANK, paid_at, cancelled)` (`mig/V4:126-187`).

**Trạng thái**: `DRAFT` (Đang tạo, lúc insert) → `TEMP` (Tạm tính, sau mỗi lần tính) → `LOCKED` (Đã chốt lương); `CANCELLED` (Đã hủy) (`PayrollService.java:22-25`, `PayrollRepository.java:35-36, :99-103`).

**Quy tắc**
- Tạo: kỳ trống → kỳ lương hiện tại theo `startDay`; chỉ có start → +1 tháng −1 ngày; `end < start` hoặc > start + 62 ngày → 400 `INVALID_PERIOD`; tên mặc định "Bảng lương tháng M/YYYY"; tạo xong tính ngay (`PayrollController.java:77-89`, `PayrollService.java:46-57`).
- Kỳ lương: bắt đầu ngày `startDay` (1–28) của tháng chứa ngày, dài 1 tháng (`id/hr/payroll/PayRates.java:20-28`).
- Tính lại: chỉ DRAFT/TEMP (khác → 400 `PAYROLL_LOCKED`), khóa dòng `FOR UPDATE`; giữ thưởng nhập tay; NV thuộc bảng = có loại lương **và** (WORKING hoặc có ngày nghỉ hoặc có công đã duyệt trong kỳ) **và** (bảng không chọn chi nhánh hoặc NV thuộc chi nhánh chính/làm việc); NV không còn thuộc bảng và phiếu chưa trả đồng nào → xóa phiếu (`PayrollService.java:59-102`, `PayrollRepository.java:44-56`).
- Sửa thưởng → tính lại cả bảng; không có phiếu → 404 `PAYSLIP_NOT_FOUND`.
- Chốt: chỉ TEMP → LOCKED (khác → 400 `PAYROLL_NOT_TEMP`).
- Hủy: có phiếu thanh toán chưa hủy → 400 `PAYROLL_PAID`; đã hủy/không có → 404 `PAYROLL_NOT_FOUND`.
- Việc nền (`id/hr/HrJobs.java:45-68`): 1 phút sau khởi động rồi mỗi 6 giờ — `autoCreate` → nếu kỳ hiện tại chưa có bảng lương chưa hủy và có NV đang làm có lương → tạo bảng (người tạo "Hệ thống"); `autoUpdate` → tính lại mọi bảng TEMP có `period_end ≥ hôm nay − 7`.

**Công thức phiếu lương** (`id/hr/payroll/PayrollCalculator.java:20-173`, `PayRates.java:30-79`) — chỉ dùng ô chấm công **đã duyệt**:
- Ngày công chuẩn `std` = số ngày trong kỳ rơi vào ngày làm việc của chi nhánh chính (`hr.workdays`; chưa thiết lập = cả 7 ngày), tối thiểu 1. `employedDays` = ngày làm việc trong [max(kỳ đầu, start_date), min(kỳ cuối, end_date)].
- Lương ngày = lương tháng ÷ std (6 chữ số thập phân, HALF_UP).
- `STANDARD_DAY`: base = Σ ngày (lương ngày × ngày công quy đổi của ngày). `FIXED`: base = lương tháng nếu employedDays ≥ std, ngược lại lương × employedDays ÷ std (vào/nghỉ giữa kỳ).
- `SHIFT`: mỗi ca có phút làm > 0 → 1 lần lương ca; work units +1/ca. `HOUR`: lương giờ × phút ÷ 60; units = giờ (2 chữ số).
- Phụ trội lễ: tiền ngày/ca × (hệ số% − 100)/100 (hệ số 200% → +100%); nhiều kỳ lễ trùng → lấy hệ số lớn nhất (`HrSettingsService.java:67-71`).
- Làm thêm: đơn giá giờ × phút OT ÷ 60 × `overtime_percent`/100 × (hệ số lễ/100 nếu ngày lễ). Đơn giá giờ: HOUR = lương; SHIFT = lương × 60 ÷ phút ca; STANDARD_DAY/FIXED = lương ngày ÷ giờ công chuẩn.
- Đếm đi muộn/về sớm theo **lượt ca**; miễn đếm với lương theo ngày khi bật quy đổi, ngày đó đúng 0.5 công và `lateEarlyForHalf=false`.
- Phụ cấp: `DAY` × số ngày có làm, `MONTH` × 1. Giảm trừ: `LATE` × số lượt muộn, `EARLY` × số lượt sớm, `MONTH` × 1.
- Hoa hồng: doanh thu người bán (= `user_id` của NV) × luật của bảng hoa hồng NV áp dụng (chỉ bảng `active`): `PERCENT` → doanh thu × %/100 (doanh thu = `netRevenue` nếu `commissionBase=NET`, `paidRevenue` nếu `PAID`); `AMOUNT` → số lượng × số tiền; làm tròn từng dòng.
- Làm tròn đồng (HALF_UP) cho base, OT, lễ, tổng phụ cấp, tổng giảm trừ, từng dòng hoa hồng, BHXH, thuế.
- gross = base + OT + lễ + phụ cấp + hoa hồng + thưởng − giảm trừ.
- BHXH (nếu bật) = (lương theo ngày/cố định: lương tháng gốc; khác: base) × `insuranceRate`%.
- Thuế TNCN (nếu bật) = max(0, gross − BHXH − `taxDeduction`) × `taxRate`% (thuế suất phẳng).
- total = max(0, gross − BHXH − thuế). `details` JSON: standardDays, employedDays, workedDays, lateCount, earlyCount, overtimeMinutes, shifts, allowances[], deductions[], commissions[].
- Gọi chéo: `sales-service GET /internal/seller-revenue?from&to` (JWT nội bộ) chỉ khi có NV có bảng hoa hồng + tài khoản; lỗi → 400 `SALES_UNAVAILABLE` (`id/hr/commission/SellerRevenueClient.java:316-344`).

#### 4.13.6 Thanh toán lương

(`id/hr/payroll/PayrollPaymentService.java:16-107`)
- Chỉ bảng `LOCKED` (khác → 400 `PAYROLL_NOT_LOCKED`); `items[{payslipId, cashAmount, advanceAmount}]` không rỗng, `method CASH|BANK` (mặc định CASH), `paidAt` mặc định now.
- Số âm → 400 `INVALID_AMOUNT`; dòng tổng 0 bỏ qua; cash + advance > còn cần trả → 400 `OVERPAY`; advance > số dư tạm ứng → 400 `ADVANCE_EXCEEDED`.
- Mỗi dòng: mã `PCPL%06d`; advance → ghi `hr_advances(DEDUCT)`; cộng `paid` phiếu; outbox phiếu chi Sổ quỹ `sourceType=PAYROLL`, category "Chi trả lương nhân viên", quỹ CASH/BANK, số tiền = **chỉ phần tiền mặt/chuyển khoản**; chi nhánh = chi nhánh chính NV → chi nhánh của bảng → chi nhánh active đầu tiên theo mã.
- Hủy thanh toán: không có/đã hủy → 404 `PAYMENT_NOT_FOUND`; đánh dấu hủy phiếu + khấu trừ kèm theo, trừ `paid`, gửi CANCEL qua outbox nếu có tiền mặt; Lịch sử thao tác "Bảng lương / Hủy thanh toán".
- **Outbox** (`id/hr/HrCashflowOutbox.java:21-109`): ghi cùng transaction (MANDATORY); job mỗi `app.outbox-delay-ms` (mặc định 5000 ms) gửi tối đa 50 bản ghi cũ nhất tới `POST {SALES_URL}/internal/cashflows`; lỗi → tăng `attempts`, dừng ở bản lỗi đầu (giữ thứ tự CREATE→CANCEL); Sổ quỹ nhận idempotent theo (sourceType, sourceId); số tiền ≤0 không gửi.

#### 4.13.7 Bảng hoa hồng

- API `/api/hr/commission-tables`: GET, `GET /rules`, POST, PUT/DELETE `/{id}`, `PUT /{id}/rules {items ≤5000}`, `GET/PUT /{id}/employees` (`id/hr/commission/CommissionController.java:31-83`).
- Dữ liệu: `hr_commission_tables(name UNIQUE ≤150, active)`, `hr_commission_rules(table_id, product_id, rate_type PERCENT|AMOUNT, value ≥0)` (`mig/V4:14-28`).
- Quy tắc (`CommissionService.java`): tên trùng → 409 `NAME_EXISTS`; không có → 404 `TABLE_NOT_FOUND`; `active` mặc định true; rule value null → xóa mức mặt hàng; rateType mặc định PERCENT; % > 100 → 400 `INVALID_RATE`; màn hình áp theo nhóm hàng bằng cách gửi mức cho từng mặt hàng; đặt danh sách NV → bỏ áp dụng các NV cũ của bảng; mỗi NV tối đa 1 bảng (cột `commission_table_id`); xóa bảng → NV về null (FK SET NULL), rule cascade.

#### 4.13.8 Thiết lập nhân viên

**API** `/api/hr/settings`: `GET` (tất cả), `GET /overview` (tiến độ Khởi tạo 6 bước), `PUT /timekeeping`, `/payroll`, `/workdays {items}`, `/holidays {items}`, `/mobile`, `/templates {items}` (`id/hr/settings/HrSettingsController.java:25-83`).

**Khóa & mặc định** (`id/hr/settings/HrSettings.java:18-92`, `HrSettingsService.java:30-55`)

| Khóa | Trường | Mặc định |
|---|---|---|
| `hr.timekeeping` | standardHours (1–24), convertEnabled, halfFrom/fullFrom (0–1440 phút), lateEarlyForHalf, lateEnabled/lateAfter (0–600), earlyEnabled/earlyBefore, otBeforeEnabled/otBefore, otAfterEnabled/otAfter, otActualAll, singleInOutMultiShift, autoTimekeeping, allowUnscheduled | 8h, tắt quy đổi, 60/270 phút, false, muộn bật 0, sớm bật 0, OT trước bật 0, OT sau bật 0, false, false, false, **allowUnscheduled=true** |
| `hr.payroll` | startDay (1–28), hourMode ACTUAL\|SHIFT, autoCreate, autoUpdate, allowances[], deductions[] (tên ≤100), taxEnabled, taxRate (0–100), taxDeduction ≥0, insuranceEnabled, insuranceRate (0–100), commissionBase NET\|PAID | 1, ACTUAL, true, true, [], [], false, 10, 11.000.000, false, 10.5, NET |
| `hr.workdays` | `[{branchId, days[1..7]}]` | [] → mọi chi nhánh 7 ngày |
| `hr.holidays` | `[{id, name ≤100, from, to, multiplier 0–1000 %}]` | [] |
| `hr.mobile` | enabled, requireQr | true, true |
| `hr.templates` | mẫu lương `[{id, name, salaryType, salaryAmount, overtimePercent, commissionTableId, allowances[], deductions[]}]` | [] |

**Quy tắc lưu** (`id/hr/settings/HrSettingsManageService.java:53-100`): bật quy đổi mà `fullFrom ≤ halfFrom` → 400 `INVALID_CONVERSION`; danh sách tên phụ cấp/giảm trừ trim + bỏ trùng; thứ trong tuần bỏ trùng + sắp xếp; kỳ lễ `to < from` → 400 `INVALID_HOLIDAY`; id trống → sinh mới; mỗi lần lưu ghi Lịch sử thao tác "Nhân viên / Sửa".
- Tiến độ Khởi tạo (`HrSetupProgressRepository.java:16-44`): employees (WORKING), shifts (active), schedules, timekeeping (= số khóa `hr.mobile`/`hr.timekeeping` đã lưu + lượt chấm PHONE/MACHINE), salaries (NV có loại lương), payrolls (chưa hủy).

#### 4.13.9 Giới hạn đã biết (HR)
- Thuế TNCN dùng thuế suất phẳng `taxRate`, không lũy tiến; BHXH 1 tỷ lệ.
- Không có API hủy tạm ứng riêng; DRAFT chỉ tồn tại trong transaction tạo (tạo xong tính ngay → TEMP).
- Tự động chấm công chỉ quét 3 ngày gần nhất; ô AUTO chưa duyệt sẽ không tính lương tới khi duyệt.
- Việc nền (`HrJobs`, outbox) không có khóa phân tán (nhiều instance → chạy trùng).

#### 4.13.10 Frontend HR (route, lọc, xuất/nhập file)
- Menu "Nhân viên" chỉ hiện khi có `hr.manage`: `/employees` (danh sách), `/employees/schedules`, `/employees/timesheets`, `/employees/payrolls[/{id}]`, `/employees/commissions`, `/employees/settings/{start,timekeeping,payroll,workdays,mobile,machine}` (`fe/components/layout/app-header-nav-menu.tsx:66-73`, `fe/features/hr/hr-settings-shell.tsx:15-25`).
- Xuất CSV (UTF-8 BOM, thoát CSV-injection) phía trình duyệt (`fe/features/hr/hr-queries.ts:105`):
  - `danh-sach-nhan-vien.csv`: Mã NV, Mã chấm công, Tên, SĐT, CCCD, Phòng ban, Chức danh, Loại lương, Mức lương, Nợ, Ghi chú — **chỉ trang đang tải** (`fe/app/(admin)/employees/page.tsx:56-61`).
  - `bang-luong.csv`: Mã, Tên, Kỳ hạn trả (Hàng tháng), Kỳ làm việc, Tổng lương, Đã trả, Còn cần trả, Trạng thái — dòng đã chọn hoặc tất cả trên trang (`fe/app/(admin)/employees/payrolls/page.tsx:49-54`).
  - `{BLxxxxxx}.csv`: phiếu lương từng NV (lương chính, OT, lễ, phụ cấp, hoa hồng, thưởng, giảm trừ, BHXH, thuế, tổng, đã trả, còn lại) (`fe/app/(admin)/employees/payrolls/[id]/page.tsx:36-41`).
  - `lich-lam-viec-{from}.csv` (lịch tuần), `bang-hoa-hong.csv`.
- Nhập CSV phía trình duyệt: lịch làm việc (cột Mã nhân viên, Ngày, Ca theo tiêu đề; không tiêu đề → 3 cột đầu; `,` hoặc `;`) → `POST /api/hr/schedules/import` (`fe/features/hr/schedule-import-button.tsx:40-83`); bảng hoa hồng (cột "Mã hàng"/"code" + 1 cột mỗi tên bảng hoa hồng; giá trị trống → bỏ mức) (`fe/features/hr/commission-csv-import.tsx:27-50`).
- QR chấm công tại quầy: gọi `/hr/clock/qr` và vẽ QR chứa URL `{origin}/cham-cong?t={token}`, đếm ngược và làm mới (`fe/features/hr/branch-clock-qr-display.tsx:30-50`). Màn `/cham-cong` (ngoài layout quản lý, cần đăng nhập): đọc `?t=` hoặc quét trong trang; FE coi token tươi trong **100 giây** rồi bỏ (`fe/features/hr/mobile-clock-screen.tsx:19-42`). Middleware nhớ `/cham-cong?t=` qua cookie `vx_after_login` (10 phút) để quay lại sau đăng nhập (`fe/middleware.ts:6-28`).

---

### 4.14 Frontend: phiên đăng nhập (BFF, cookie, middleware, cổng kiểm tra)

**Route**: `/welcome` (giới thiệu + nhập địa chỉ cửa hàng), `/login`, `/cham-cong`, `/sale`, khu quản lý `(admin)`; BFF: `/api/session/login|logout|store`, `/api/backend/[...path]` (`fe/app/api/**`).

**Quy tắc**
- **JWT không bao giờ tới JS trình duyệt**: cookie httpOnly `vx_access` (maxAge = `expiresIn`), `vx_refresh` (7 ngày nếu "Duy trì đăng nhập", ngược lại cookie phiên), `vx_persist`; `sameSite=lax`; `secure` khi production trừ khi `COOKIE_SECURE=false` (`fe/lib/server/session-cookies.ts:5-41`).
- BFF `/api/backend/<path>` → `{GATEWAY_URL}/api/<path>` gắn `Authorization: Bearer`; gặp 401 → refresh 1 lần rồi gửi lại; chỉ trả lại `Content-Type`; gateway không tới được → 502 `GATEWAY_UNREACHABLE` (`fe/app/api/backend/[...path]/route.ts:5-45`).
- `api()` phía trình duyệt: 401 (refresh thất bại) → `window.location = /login`; lỗi → `ApiRequestError{status, code, message, details}` (`fe/lib/api-client.ts:19-33`).
- Middleware: không có cookie `vx_refresh` và không phải `/welcome`, `/login` → chuyển `/welcome`; có phiên mà mở trang công khai → `/` (`fe/middleware.ts:3-33`). Bỏ qua `api`, `_next`, `sw.js`, `brand/`, `data/`.
- Luồng đăng nhập (`fe/app/login/page.tsx:20-69`, `fe/features/auth/store-access-dialog.tsx:11-41`):
  1. Địa chỉ cửa hàng từ `?store=` hoặc `localStorage.vx_store`; không có/sai → `/welcome?login=1`.
  2. Gửi `{username, password, remember, code?}`; nhận `TOTP_REQUIRED` → hiện ô mã (≤11 ký tự: 6 số hoặc mã khôi phục `xxxxx-xxxxx`).
  3. Chọn "Quản lý" → `/`, "Bán hàng" → `/sale`.
- `StoreAccessGate` (mọi trang trừ `/login`, `/welcome`, `/cham-cong`) (`fe/features/store-profile/store-access-gate.tsx:16-91`): bảo lưu → màn phủ toàn trang (trừ `/store-profile` để chủ GH mở lại); chưa đồng ý điều khoản phiên bản hiện hành → hộp bắt buộc đồng ý (hoặc đăng xuất). Trạng thái gian hàng poll **60 giây** (`fe/features/store-profile/store-profile-queries.ts:42`); điều khoản cache 10 phút (`fe/features/store-profile/terms-queries.ts:12`).
- `useCurrentUser()` = `GET /auth/me`, staleTime 5 phút; `can(perm)` chỉ để ẩn/hiện menu — backend vẫn kiểm (`fe/lib/use-current-user.ts:27-31`).
- Tài khoản (menu avatar): Xác thực 2 lớp (dialog bật/tắt/tạo lại mã), "Hồ sơ cửa hàng" chỉ hiện cho chủ GH hoặc `settings.manage`, chủ đề màu, ngôn ngữ, đăng xuất (`fe/components/layout/account-menu-dropdown.tsx:29-71`).

**Giới hạn**
- ~~Đăng xuất không thu hồi refresh token ở server~~ — **đã sửa (audit #1)**: `/api/auth/logout` public ở gateway + identity (`gw/java/com/vaxclinic/gateway/GatewaySecurityConfig.java:35`, `backend/identity-service/src/main/resources/application.yml:28`); BFF gửi refresh token trong body (không cần Bearer, chạy được cả khi access token đã hết hạn) (`fe/app/api/session/logout/route.ts:5-14`) → dòng refresh token bị xóa. Xóa (thay vì đánh dấu revoked) để tab cũ gửi lại token không kích hoạt "dùng lại token đã thu hồi → thu hồi mọi phiên".
- Access JWT không trạng thái: sau đăng xuất access token cũ vẫn hợp lệ tới hết TTL (≤30 phút) nếu ai đó đã chép được; trình duyệt mất cookie nên không dùng tiếp. Chưa có danh sách thu hồi access token (thiết kế chọn).
- Không có màn tự đổi mật khẩu / quên mật khẩu (không thấy API hay UI).
- BFF không chuyển tiếp `X-Forwarded-For` → giới hạn đăng nhập sai thực tế theo tên đăng nhập.

---

### 4.15 Frontend: quyền trên menu Thiết lập

Menu trái Thiết lập (`fe/features/settings/settings-shell.tsx:20-57`; mục có `perm` chỉ hiện khi có quyền; các trang sửa còn kiểm `can()` để khóa nút lưu):

| Nhóm | Mục (route) | Quyền hiển thị / sửa |
|---|---|---|
| Quản lý | Hàng hóa `/settings/products` | sửa: `catalog.manage` |
| | Đơn hàng `/settings/orders` | sửa: `settings.manage` |
| | Khách hàng `/settings/customers` | sửa: `settings.manage` |
| | Sổ quỹ/TK ngân hàng `/settings/bank-accounts` | `cashbook.manage` |
| | Thuế & Kế toán `/settings/tax` | sửa: `settings.manage` |
| | Hóa đơn điện tử `/settings/einvoice` | `user.manage` |
| | Mẫu in `/settings/print-templates` | sửa: `settings.manage` |
| Tiện ích | Thanh toán (SePay) `/settings/payments` | `settings.manage` / `cashbook.manage` |
| | Thông báo `/settings/notifications` | `settings.manage` |
| Cửa hàng | Thông tin cửa hàng `/settings/store` | sửa: `settings.manage` |
| | Người dùng `/settings/users` | `user.manage` |
| | Chi nhánh `/settings/branches` | sửa: `branch.manage` |
| Dữ liệu | Khóa sổ `/settings/lock` | sửa: `settings.manage` |
| | Lịch sử thao tác `/settings/audit-logs` | `user.manage` |

- Ô "Tìm kiếm thiết lập" tìm theo nhãn + `keywords` không dấu (`settings-shell.tsx:59`).
- Form vai trò: nhóm quyền catalog/sales/cashbook/hr/vaccination/settings khớp `Permissions.java`; vai trò ADMIN hiện tick hết và khóa (`fe/features/settings/role-form-dialog.tsx:17-68`).
- Người dùng: cột Tên hiển thị, Tên đăng nhập, SĐT, Vai trò, Chi nhánh, Trạng thái (`fe/app/(admin)/settings/users/page.tsx:48-49`).
- Quyền dùng ở service khác (theo `@PreAuthorize` thấy được): `catalog.view/manage` (Product, PriceBook, Supplier...), `inventory.view/manage` (Purchase, StockTake, StockIssue, InputInvoice, TaxConnection...), `patient.view/manage` (Customer, CustomerGroup), `sales.perform` (Invoice, Order, SalesReturn, Shipment, EInvoice, SePay...), `sales.cancel` (Invoice, Order, SalesReturn), `cashbook.manage` (Cashbook, RevenueBook, StockBook, SePay...), `report.view` (các Report controller, EndOfDay...), `settings.manage` (job cảnh báo, SalesChannel, SePay, DigitalCertificate, EInvoicePackage), `user.manage` (EInvoiceController). **`reception.perform`, `screening.perform`, `injection.perform` không được kiểm ở controller nào** (chỉ xuất hiện trong danh mục quyền + form vai trò).

---

### 4.16 Frontend: mẫu in (placeholder, sanitizeHtml)

- Màn `/settings/print-templates` (`fe/app/(admin)/settings/print-templates/page.tsx`), editor xem trước khổ A5 + "In thử" (`fe/features/print/print-template-editor.tsx:12-65`); dùng khi in hóa đơn bán hàng (`fe/features/sale/use-sale-invoice-printer.ts:6-39`), nút in chung (`fe/features/print/print-button.tsx:9-20`).
- 7 loại = backend; nhóm: Đơn hàng (Hóa đơn, Hóa đơn giao hàng, Trả hàng), Sổ quỹ (Phiếu thu, Phiếu chi), Hàng hóa (Nhập hàng, Trả hàng nhập) (`fe/features/print/print-template-defaults.ts:4, 87-205`).
- Cú pháp (`fe/features/print/print-render.ts:1-22`): `{Ten_Truong}` → giá trị đã escape HTML; khối lặp `{#Dong_Hang}...{/Dong_Hang}` theo dòng hàng; `{Logo}` → `<img>` (max 60×140px); trường không có giữ nguyên chữ.
- Trường chung (`print-template-defaults.ts:12-20`): `Logo, Ten_Cua_Hang, Dia_Chi_Cua_Hang, Dien_Thoai_Cua_Hang, MST_Cua_Hang, Ten_Chi_Nhanh, Ngay, Thang, Nam, Nguoi_Tao`. Dòng hàng: `STT, Ma_Hang, Ten_Hang, Don_Vi, So_Luong, Don_Gia, Thanh_Tien, So_Lo` (+ `Chiet_Khau` ở Hóa đơn, `Han_Dung` ở Nhập hàng).
- Theo loại:
  - INVOICE: `Ma_Hoa_Don, Ngay_Ban, Khach_Hang, Ma_Khach_Hang, SDT_Khach_Hang, Dia_Chi_Khach_Hang, Dia_Chi_Giao_Hang, Nguoi_Ban, Tong_So_Luong, Tong_Tien_Hang, Giam_Gia, Tong_Cong, Tong_Cong_Bang_Chu, Khach_Da_Tra, Con_No, PT_Thanh_Toan, Ghi_Chu` + thuế/đơn thuốc `Giam_Thue, Phuong_Phap_Giam_Thue, Thong_Tin_Don_Thuoc, Ma_Don_Thuoc, Bac_Si_Ke_Don, Co_So_Kham, Chan_Doan`.
  - DELIVERY_INVOICE: `Ma_Hoa_Don, Ngay_Ban, Khach_Hang, Nguoi_Nhan, SDT_Nguoi_Nhan, Dia_Chi_Giao_Hang, Ma_Van_Don, Thu_Ho, Nguoi_Ban, Tong_So_Luong, Tong_Tien_Hang, Giam_Gia, Tong_Cong, Khach_Da_Tra, Ghi_Chu` + thuế/đơn thuốc.
  - SALES_RETURN: `Ma_Tra_Hang, Ma_Hoa_Don, Ngay_Tra, Khach_Hang, Tong_Tien_Hang, Giam_Gia, Phi_Tra_Hang, Can_Tra_Khach, Da_Tra_Khach, Can_Tra_Khach_Bang_Chu, Ghi_Chu`.
  - CASH_RECEIPT / CASH_PAYMENT: `Ma_Phieu, Ngay_Tao, Doi_Tuong, SDT_Doi_Tuong, Loai_Thu_Chi, So_Tien, So_Tien_Bang_Chu, Quy, Ghi_Chu`.
  - PURCHASE_RECEIPT: `Ma_Phieu, Ngay_Nhap, Nha_Cung_Cap, So_HD_Dau_Vao, Tong_So_Luong, Tong_Tien_Hang, Chiet_Khau, Thue_VAT, Can_Tra_NCC, Da_Tra_NCC, Ghi_Chu`.
  - PURCHASE_RETURN: `Ma_Phieu, Ma_Phieu_Nhap, Ngay_Tra, Nha_Cung_Cap, Tong_Tien_Hang, Giam_Gia, Thue_VAT, NCC_Can_Tra, NCC_Da_Tra, Ghi_Chu`.
- Số tiền bằng chữ tiếng Việt (`amountInWords`: "Một triệu năm trăm nghìn đồng"; 0 → "Không đồng") (`print-render.ts:75-102`).
- `sanitizeHtml` (`print-render.ts:24-38`): xóa thẻ `script, iframe, object, embed, link, meta, base, form`; xóa mọi thuộc tính `on*`; xóa `href/src` bắt đầu `javascript:` hoặc `data:` (trừ `data:image/`); phía server trả rỗng. In qua iframe ẩn `sandbox="allow-modals allow-same-origin"`, khổ A5 dọc lề 8mm, Times New Roman 12px, chờ ảnh tải xong (`:40-73`). Báo cáo in cũng dùng `sanitizeHtml` (`fe/features/reports/report-print.ts:5-39`).
- Giới hạn: không lọc `style`/CSS (`url()`), không lọc `<svg>`; backend lưu HTML thô ≤200.000 ký tự.

---

### 4.17 Frontend: ngôn ngữ (i18n) & chủ đề màu; security headers

- **Ngôn ngữ** (`fe/lib/i18n/locales.ts:7-38`): `vi` (nguồn + mặc định), `en`, `ja`, `zh` (ja/zh gắn "Bản thử nghiệm"); chỉ chữ giao diện đổi — tiền/ngày vẫn định dạng VN (VND, dd/MM/yyyy). Lưu cookie `vx_locale` (1 năm, để server render đúng) + `localStorage.vx_locale`; giá trị lạ → `vi` (`fe/lib/i18n/i18n-provider.tsx:17-43`). en/ja/zh tải lười theo namespace (`fe/lib/i18n/message-store.ts:4`). Namespace JSON: accounting, auth, cashbook, common, customers, dashboard, delivery, errors, hr, inventory, nav, notifications, orders, print, products, purchases, reports, sale, sales, settings, store-profile (`fe/messages/{vi,en,ja,zh}/`). Chọn ngôn ngữ ở màn đăng nhập và menu tài khoản.
- Lỗi API (`fe/lib/i18n/translate-api-error.ts:1-35`): tiếng Việt → giữ message server; ngôn ngữ khác → `errors.codes.<CODE>` (thay hẳn) hoặc `codesWithDetail.<CODE>` ("bản dịch (message gốc)"), không có → message server; lỗi validation giữ chi tiết tiếng Việt kèm tiền tố đã dịch. Nhãn tính năng/thao tác Lịch sử thao tác dịch qua `fe/lib/i18n/audit-labels.ts`.
- **Chủ đề màu** (`fe/lib/accent-theme.ts:1-74`): 9 màu (blue `#0070f4` mặc định, slate, green, purple, red, sage, teal, orange, pink); lưu theo từng user ở `localStorage` (`kv-accent:{userId}`, `kv-accent-user`) — backend **không** lưu; chỉ tô khung ứng dụng (biến `--chrome`: thanh menu, nút Bán hàng, avatar, nút THANH TOÁN), `--primary` nội dung giữ xanh; script trong `<head>` áp màu trước khi vẽ (bỏ qua `/login`, `/welcome`).
- **Security headers**: `next.config.ts` chỉ có redirect `/pos → /sale` (`frontend/next.config.ts:3-10`); không tìm thấy cấu hình CSP / X-Frame-Options / HSTS / rate limit nào trong repo (frontend, gateway).

---

### 4.18 Tổng quan (dashboard)

- Trang chủ `/` (`fe/features/dashboard/dashboard-page-content.tsx:23-25`): khối doanh thu cần `report.view` hoặc `cashbook.manage`; số hóa đơn cần `sales.perform` hoặc `report.view`; "Hoạt động gần đây" cần `user.manage`.
- Kỳ: Hôm nay, Hôm qua, 7 ngày qua, Tháng này, Tháng trước (`fe/features/dashboard/dashboard-date-utils.ts:7-31`).
- Nguồn: `/accounting/revenue/daily`, `/invoices?statuses=COMPLETED` (doanh thu theo giờ cộng phía trình duyệt, tối đa 20 trang × 100 hóa đơn; vượt → không vẽ), `/audit-logs?size=10` poll 60 giây, tên hàng `/products/{id}` cache 5 phút (`fe/features/dashboard/dashboard-queries.ts:15-72`). Chuông thông báo poll 30 giây khi tab đang mở (`fe/components/layout/notification-queries.ts:27-28`).

---

### 4.19 Khác

- **Tìm kiếm không dấu** dùng chung (`AccentInsensitiveSql.like`) cho họ tên user/NV (`mig/V10__accent_insensitive_search.sql`).
- **Logo cửa hàng**: FE thu nhỏ về tối đa 256 px PNG data URL, chặn file > 2 MB (`fe/app/(admin)/settings/store/page.tsx:20-32, :98`); dùng ở màn đăng nhập (`/api/auth/store`) và đầu mẫu in.
- **Khóa sổ FE**: ngày mặc định khi bật = hôm qua; bảng theo chi nhánh (Chi nhánh, Ngày khóa) + "Áp dụng tất cả" (`fe/app/(admin)/settings/lock/page.tsx:16-66`).
- **Lịch sử thao tác FE**: lọc Nhân viên (`/users/lookup`), Tính năng (`/audit-logs/features`), từ–đến ngày, ô tìm; 20 dòng/trang; xuất qua BFF rồi tải `lich-su-thao-tac.csv` (`fe/app/(admin)/settings/audit-logs/page.tsx:33-62`).
- **Thông báo FE**: trang `/settings/notifications` gồm số ngày cảnh báo lô hết hạn + danh sách/viết thông báo nội bộ (`fe/app/(admin)/settings/notifications/page.tsx:33-59`).
- **Mã chứng từ do identity sinh**: `NV000001` (nhân viên), `BL000001` (bảng lương), `PCPL000001` (thanh toán lương), `PCTU000001` (tạm ứng; cùng sequence với PCPL), `CUSTOM_XXXXXXXX` (vai trò tự tạo); chi nhánh mã do người dùng nhập (seed `CN001`).

---

### Câu hỏi chưa rõ

1. ~~Logout BFF không thu hồi refresh token~~ — đã sửa: `/api/auth/logout` public, xem mục 4.14.
2. `reception.perform`, `screening.perform`, `injection.perform` không có endpoint nào kiểm — giữ lại cho quy trình tiêm tương lai hay bỏ?
3. Vai trò hệ thống ngoài ADMIN không được seed quyền mặc định trong migration (comment `Permissions.java:7` nói "seeded by migrations") — có migration ở nơi khác không, hay vai trò mặc định đang rỗng quyền?
4. Cấu hình HĐĐT / chứng thư số (`/api/store-profile/einvoice|certificates`) thuộc integration-service — cách mã hóa bí mật cần xem ở phần tài liệu integration.
5. Phiếu xác thực Hồ sơ cửa hàng dùng lại được trong 10 phút (không đánh dấu đã dùng) — có chấp nhận không?



---

## 5. Tích hợp, kế toán thuế, báo cáo

Viết tắt đường dẫn khi trích dẫn:
- `IS/` = `backend/integration-service/src/main/java/com/vaxclinic/integration/`; `IS-res/` = `backend/integration-service/src/main/resources/`
- `SS/` = `backend/sales-service/src/main/java/com/vaxclinic/sales/`; `SS-res/` = `backend/sales-service/src/main/resources/`
- `PS/` = `backend/product-service/src/main/java/com/vaxclinic/product/`; `PS-res/` = `backend/product-service/src/main/resources/`
- `ID/` = `backend/identity-service/src/main/java/com/vaxclinic/identity/`
- `FE/` = `frontend/src/`; `GW` = `backend/gateway-service/src/main/resources/application.yml`

Quy ước chung (đọc từ code):
- Múi giờ nghiệp vụ: `ShopSettings.ZONE = Asia/Ho_Chi_Minh` (`backend/common-lib/.../settings/ShopSettings.java:20`); SQL báo cáo cắt ngày/tháng bằng `at time zone 'Asia/Ho_Chi_Minh'` (`SS/report/ReportFilter.java:27`).
- Frontend tính khoảng ngày theo **giờ máy người dùng** (`new Date(y,m,d)` → `toISOString()`), không ép +07:00 (`FE/features/reports/report-api.ts:11`, `FE/features/reports/report-time-presets.ts:27-44`, `FE/features/dashboard/dashboard-date-utils.ts:56`). Ngoại lệ: Sổ tiền S2e ép `+07:00` (`FE/features/accounting/stock-and-cash-book-tabs.tsx:70-71`).
- Gọi service↔service: JWT dịch vụ quyền `internal` (`ServiceTokenProvider`), đường `/internal/**` không đi qua gateway (`SS/accounting/SellerRevenueInternalController.java:13`).
- Định tuyến gateway: `/api/reports/inventory/**`, `/api/reports/suppliers/**` → product-service (`GW:33`), còn lại `/api/reports/**`, `/api/accounting/revenue/**`, `/api/cashbook/**` → sales-service (`GW:42`); `/api/accounting/stock/**` → product (`GW:37`); `/api/tax-connections|input-invoices|einvoice|einvoices|payments|payment-requests/**` → integration-service (`GW:47`); `/api/store-profile/einvoice|certificates/**` → integration (khớp trước identity) (`GW:22-26`).

---

### 5.1 Mã hóa thông tin đăng nhập bên thứ ba (dùng chung)

1. **Mục đích**: mã hóa mật khẩu cổng thuế, mật khẩu MISA, API key SePay trước khi lưu DB.
2. **Dữ liệu**: cột `tax_connections.password_enc`, `einvoice_settings.password_enc`, `sepay_settings.api_key_enc` (`IS-res/db/migration/V1__init_integration_schema.sql:2-7,46`, `V2__sepay_payments.sql:5`).
3. **Quy tắc**:
   - AES-256-GCM, IV ngẫu nhiên 12 byte (`SecureRandom`), tag 128 bit; lưu `base64(iv || ciphertext+tag)` (`IS/common/SecretCipher.java:16-17,34-45`).
   - Khóa từ biến môi trường `ENCRYPTION_KEY` (cấu hình `app.encryption-key`, base64, **bắt buộc 32 byte**, sai → `IllegalStateException` lúc khởi động) (`IS-res/application.yml:26`, `IS/common/SecretCipher.java:26-32`).
   - Giải mã lỗi → `"Decrypt failed (ENCRYPTION_KEY changed?)"` (`SecretCipher.java:53-55`) — đổi khóa làm hỏng mọi bản đã lưu.
   - Không API nào trả mật khẩu/API key; chỉ trả cờ `configured` (`IS/einvoice/EInvoiceSettingsService.java:31-46`, `IS/payment/SePayService.java:46-53`, `IS/inputinvoice/TaxConnectionRepository.java:16-19`).
   - Lưu thiết lập: để trống mật khẩu/key = giữ giá trị cũ (`coalesce(excluded.password_enc, …)`) (`IS/einvoice/EInvoiceRepository.java:36`, `IS/payment/SePayRepository.java:41`, `IS/inputinvoice/TaxConnectionRepository.java:47-52`).
   - Các bí mật khác chỉ được đặt tên: `JWT_SECRET`, `DB_PASSWORD` (`IS-res/application.yml:10,24`).
5. **Giới hạn**: không có cơ chế xoay khóa (re-encrypt) trong code.

---

### 5.2 Hóa đơn điện tử MISA meInvoice (bán ra)

1. **Mục đích + route + API**
   - Thiết lập: FE `/settings/einvoice` (`FE/app/(admin)/settings/einvoice/page.tsx`); phát hành: nút trong chi tiết hóa đơn bán (`FE/features/integrations/einvoice-status.tsx:15-51`); trạng thái ở danh sách hóa đơn (`FE/features/sales/invoice-einvoice-state.ts`).
   - API (`IS/einvoice/EInvoiceController.java`):

| Method + path | Quyền | Dòng |
|---|---|---|
| GET `/api/einvoice/settings` | `user.manage` | 41-45 |
| PUT `/api/einvoice/settings` | `user.manage` | 48-52 |
| POST `/api/einvoice/settings/test` (thử đăng nhập MISA) | `user.manage` | 55-59 |
| POST `/api/einvoices/{invoiceId}/publish` | `sales.perform` | 61-65 |
| GET `/api/einvoices?invoiceIds=…` | `sales.perform` hoặc `report.view` | 68-72 |
| GET `/internal/einvoices/statuses` | `internal` | 78-82 |
| GET `/internal/einvoices/{id}/published` | `internal` | 85-89 |

2. **Dữ liệu**
   - `einvoice_settings` 1 dòng (`id = 1` CHECK): provider `MISA`, environment `TEST|PROD`, app_id, tax_code, username, password_enc, inv_series, invoice_name (mặc định "Hóa đơn bán hàng"), send_email (`V1__init_integration_schema.sql:39-51`).
   - `einvoice_records` (PK = `invoice_id` của sales-service): status `PUBLISHED|FAILED`, `ref_id` (giữ nguyên khi thử lại), transaction_id (mã tra cứu), inv_series, inv_no, inv_code (mã CQT), inv_date, error, attempts (`V1…sql:54-67`).
   - URL MISA: test `https://testapi.meinvoice.vn`, prod `https://api.meinvoice.vn`; path token `MISA_TOKEN_PATH` (mặc định `/api/v3/auth/token`), path phát hành `MISA_PUBLISH_PATH` (mặc định `/api/v3/code/itg/invoice-calculating/invoiceandpublish`) (`IS-res/application.yml:35-39`).
3. **Quy tắc nghiệp vụ**
   - Lưu thiết lập: validate `environment` ∈ TEST|PROD, `appId`/`taxCode`/`invSeries`/`invoiceName`/`username` NotBlank; environment null → TEST; trim; `invSeries` viết hoa (`EInvoiceController.java:26-29`, `EInvoiceSettingsService.java:49-53`). FE chỉ bật nút Lưu khi đã cấu hình hoặc có nhập mật khẩu; nút Thử kết nối khi `configured` (`FE/app/(admin)/settings/einvoice/page.tsx:62-63`).
   - "Đã cấu hình" = có `password_enc` (`EInvoiceSettingsService.java:37`). Phát hành yêu cầu đủ `app_id`, `password_enc`, `inv_series`, thiếu → 400 `EINVOICE_NOT_CONFIGURED` (`IS/einvoice/EInvoiceService.java:52-61`).
   - **Luồng phát hành** (`EInvoiceService.java:63-102`):
     1. Đã có record `PUBLISHED` → trả luôn record, không gọi MISA (idempotent) (:64-67).
     2. Đọc thiết lập + giải mã mật khẩu (:68-69).
     3. Gọi sales-service `GET /internal/invoices/{id}` (JWT dịch vụ) (:70-71). Dữ liệu người mua: "Thông tin xuất hóa đơn" của khách, thiếu thì thông tin chung; không có khách → "Khách lẻ"; `legalName` = tên công ty chỉ khi `customerType = COMPANY` (`SS/invoice/InternalInvoiceService.java:43-56`).
     4. Hóa đơn phải `COMPLETED`, khác → 400 `INVOICE_NOT_PUBLISHABLE` (:72-74).
     5. **Chặn phát hành tự động**: `taxReductionMethod = DIRECT` và `taxReduction > 0` → 400 `EINVOICE_DIRECT_TAX_REDUCTION_UNSUPPORTED` ("vui lòng lập trên phần mềm HĐĐT") (:75-80).
     6. RefID: lần đầu `UUID.randomUUID()` và insert record `FAILED` trước khi gọi MISA; thử lại dùng lại `ref_id` cũ → MISA chống trùng (:81-84, `EInvoiceRepository.java:73-76`).
     7. Dựng payload → `misa.publish`; `BusinessException` từ MISA được bắt và ghi thành kết quả FAILED (:93-98).
     8. `updateResult`: status PUBLISHED/FAILED, các mã, error, `attempts + 1`, `updated_at = now()` (`EInvoiceRepository.java:79-85`).
   - **Retry**: không có retry tự động/backoff. Người dùng bấm "Phát hành lại" (`einvoice-status.tsx:44-47`); job cảnh báo nhắc mỗi 15 phút (5.6).
   - **MisaClient** (`IS/einvoice/MisaClient.java`):
     - Token: POST `{appid, taxcode, username, password}`; `Success=false` hoặc `Data` rỗng → 400 `MISA_AUTH_FAILED` (:69-73). Cache 1 token trong bộ nhớ 20 giờ theo khóa `environment|taxCode|username`, `synchronized` (:63-78).
     - Phát hành: POST danh sách 1 phần tử, header `Authorization: Bearer <token>` + `CompanyTaxCode` (:80-83). `Success=false` → FAILED với `ErrorCode` + `Errors`; `Success=true` vẫn phải xem `ErrorCode` của phần tử đầu trong `Data` (Data có thể là chuỗi JSON) (:84-95); đọc `TransactionID, InvSeries, InvNo, InvCode, InvDate` (:96-97); parse lỗi → "Không đọc được phản hồi MISA" (:98-100).
     - Mã lỗi dịch: `InvalidAppID`, `InactiveAppID`, `UnAuthorize`, `InvoiceDuplicated`, `InvoiceNumberNotCotinuous` (:103-112).
     - HTTP lỗi → 502 `MISA_HTTP_<code>` (kèm body); mất kết nối → 502 `MISA_UNREACHABLE`; body rỗng → 502 `MISA_EMPTY` (:114-127). Read timeout `app.http.external-read-timeout` mặc định 30s (:49).
   - **Ánh xạ trạng thái** (backend `EInvoiceRepository.java:52-56`, FE `invoice-einvoice-state.ts:58-73`):

| Điều kiện | Trạng thái | Nhãn FE | Màu |
|---|---|---|---|
| Không có record | NONE | Chưa phát hành | gray |
| status=PUBLISHED, inv_code rỗng | PUBLISHED | Đã phát hành | blue |
| status=PUBLISHED, có inv_code | ACCEPTED | CQT chấp nhận | green |
| status=FAILED | FAILED | Phát hành lỗi | red |

   - **Payload** (`IS/einvoice/MisaInvoicePayload.java`):
     - Quy ước giá: giá bán là giá khách trả (đã gồm thuế). Tiền dòng = SL × (đơn giá − giảm giá/đv), làm tròn HALF_UP; giảm giá hóa đơn phân bổ theo tỷ lệ tiền dòng, phần dư dồn dòng cuối (:17-20, :63-76).
     - Trước thuế = round(tiền dòng × 100 / (100 + thuế suất)); thuế = tiền dòng − trước thuế (:80-85).
     - Mã thuế nội bộ → `VATRateName`: `VAT0→0%`, `VAT5→5%`, `VAT8→8%`, `VAT10→10%`, `KKKNT→KKKNT`, null/khác (gồm `KCT`, `HKD_KCT_15`) → `KCT` (:44-56).
     - **Giảm thuế (NQ 204/2025/QH15)**: dòng `taxReduced` và `VAT10` → xuất `8%`: trước thuế tính theo 10% (giá gồm 10%), tiền sau thuế = trước thuế + 8% (:29, :77-84).
     - Dòng: `ItemType=1, LineNumber, SortOrder, ItemCode, ItemName, UnitName, Quantity, UnitPrice, DiscountAmount(OC)= SL×giảm/đv + phần phân bổ, Amount(OC)=SL×đơn giá, AmountWithoutVAT(OC), VATRateName, VATAmount(OC), AmountAfterTax` (:86-107).
     - Đầu phiếu: `RefID, InvSeries, InvoiceName, InvDate = ngày bán theo Asia/Ho_Chi_Minh, IsInvoiceCalculatingMachine=true, CurrencyCode=VND, ExchangeRate=1, PaymentMethodName, Buyer*, ContactName, TotalSaleAmount = Σ SL×đơn giá, TotalAmountWithoutVAT, TotalVATAmount, TotalAmount = total hóa đơn, TotalAmountInWords, OriginalInvoiceDetail, TaxRateInfo (gom theo thuế suất), OptionUserDefined (0 chữ số thập phân)` (:117-147).
     - Phương thức: `CASH→Tiền mặt`, `TRANSFER→Chuyển khoản`, `CARD→Thẻ`, khác/null → `TM/CK` (:157-167).
     - `IsSendEmail = sendEmail && buyerEmail != null` (:151).
     - Số tiền bằng chữ: "… đồng chẵn.", 0 → "Không đồng.", số âm → "Âm …"; quy tắc lẻ/mốt/tư/lăm/mười (`IS/einvoice/VietnameseAmountInWords.java:15-64`).
   - **Liên quan sales-service**:
     - Thiết lập "Chặn chỉnh sửa/hủy hóa đơn đã phát hành HĐĐT" (`blockEditPublishedEInvoice`): sửa/hủy hỏi `/internal/einvoices/{id}/published`; integration-service không trả lời → **chặn** 503 `EINVOICE_SERVICE_DOWN`; đã phát hành → 400 `EINVOICE_PUBLISHED` (`SS/common/SalesRules.java:43-59`, gọi ở `SS/invoice/InvoiceChangeGuard.java:60,104`). Chỉ record `PUBLISHED` mới tính (`EInvoiceRepository.java:87-91`).
     - Gộp hóa đơn: luôn chặn hóa đơn PUBLISHED/ACCEPTED; integration-service lỗi → không cho gộp (`SS/invoice/InvoiceMergeService.java:136,151-156`).
     - Lọc "Trạng thái HĐĐT" ở danh sách hóa đơn: sales-service lấy toàn bộ id theo trạng thái rồi `i.id in (…)`; NONE = `not in` mọi id có record (`SS/invoice/InvoiceFilterSql.java:71-73,86-101`, `SS/invoice/EInvoiceLookupClient.java:34-49`). "Tính chất HĐĐT": chỉ ORIGINAL có kết quả (= PUBLISHED ∪ ACCEPTED), lựa chọn khác → `false` (`InvoiceFilterSql.java:74-81`).
     - FE: menu "Sửa thông tin thuế" bị khóa khi record PUBLISHED (`FE/features/sales/invoice-detail-panel.tsx:43`, `invoice-detail-footer.tsx:44-45`). Link tra cứu `https://www.meinvoice.vn/tra-cuu/?sc=<transaction_id>` (`invoice-einvoice-state.ts:79-80`).
4. **Cột/xuất**: cột danh sách hóa đơn `einvoice, einvoiceNature, einvoiceNo, einvoiceSeries`; số HĐĐT hiển thị `inv_no-inv_series` (`FE/features/sales/invoice-list-prefs.ts:61`, `invoice-einvoice-state.ts:76`).
5. **Giới hạn đã biết**
   - Không phát hành tự động khi hoàn thành hóa đơn; chỉ thủ công từ chi tiết hóa đơn (không có lời gọi publish nào khác trong code).
   - Giảm thuế phương pháp trực tiếp không phát hành được (bước 5).
   - Chỉ hóa đơn gốc; không có điều chỉnh/thay thế/hủy HĐĐT (`InvoiceFilterSql.java:75`).
   - Token cache 1 mục, không xóa khi MISA trả 401 → lỗi `MISA_HTTP_401` cho tới khi hết 20h hoặc đổi tài khoản.
   - Hai yêu cầu phát hành đồng thời lần đầu: cả hai insert vào PK `invoice_id` → yêu cầu sau lỗi trùng khóa (không bắt riêng).
   - `transaction_date`/`inv_date` lưu dạng chuỗi.

---

### 5.3 Gói hóa đơn & chữ ký số (Hồ sơ cửa hàng)

1. **Route/API**: `/store-profile/einvoice` (`FE/app/(admin)/store-profile/einvoice/page.tsx:27`), chứng thư `/store-profile/certificates`. API `GET /api/store-profile/einvoice`, `POST/PUT/DELETE …/packages[/{id}]` (`IS/storeprofile/EInvoicePackageController.java:19-48`); `GET/POST /api/store-profile/certificates`, `POST …/parse`, `PUT/DELETE …/{id}` (`IS/storeprofile/DigitalCertificateController.java:30-73`). Quyền: `settings.manage`.
2. **Dữ liệu**: `einvoice_packages` (quantity > 0, end ≥ start) và `digital_certificates` (signature_type `USB_TOKEN|HSM|RMS`, cert_status `PENDING|APPROVED|REVOKED`, chỉ lưu chứng thư công khai `cert_der`) (`IS-res/db/migration/V3__einvoice_packages_and_digital_certificates.sql:3-30`).
3. **Quy tắc**
   - Gói: tên ≤ 100, số HĐ 1…10.000.000, ngày bắt buộc; end < start → 400 `INVALID_PACKAGE_DATES` (`IS/storeprofile/EInvoicePackageModels.java:19-24`, `EInvoicePackageService.java:63-67`).
   - "Đã dùng": số record `PUBLISHED` theo ngày `updated_at` giờ VN (`EInvoicePackageRepository.java:34-42`), phân bổ từng ngày theo thứ tự thời gian vào gói có hiệu lực ngày đó còn chỗ, ưu tiên gói hết hạn sớm; dư = "chưa phân bổ" (`EInvoicePackageAllocator.java:32-51`). Trạng thái gói: NOT_STARTED / ACTIVE / EXPIRED theo hôm nay (:56).
   - Tổng hợp: total = Σ quantity; published = Σ đã phát hành; remaining = Σ còn lại của gói **chưa hết hạn**; serviceExpiry = max end_date; issuer cố định "MISA meInvoice" (`EInvoicePackageService.java:30-42`).
   - Chứng thư: file ≤ 20KB; chứa "PRIVATE KEY" → 400 `PRIVATE_KEY_REJECTED`; không phải X.509 (VD .pfx) → `INVALID_CERTIFICATE`; MST lấy theo regex `MST[:=]\s*(\d{10}(-\d{3})?)` (`IS/storeprofile/CertificateFileParser.java:31-59`). Có file thì chủ thể/MST/serial/hiệu lực lấy theo file; hết hạn < kích hoạt → `INVALID_CERT_DATES` (`DigitalCertificateService.java:69-81`).
   - Cảnh báo `CERT_EXPIRING`: chứng thư active, chưa REVOKED, hết hạn trong 30 ngày tới hoặc đã hết; đồng bộ trọn bộ mỗi 6 giờ và sau mỗi thêm/sửa/xóa; quyền nhận `settings.manage` (`IS/storeprofile/CertificateExpiryAlerts.java:24-25,37-60`).
5. **Giới hạn**: gói nhập tay (chưa gọi API hạn mức MISA) (`V3…sql:1-2`).

---

### 5.4 Hóa đơn đầu vào (cổng thuế GDT + nhập XML)

1. **Route/API**: FE `/purchases/input-invoices` (`FE/app/(admin)/purchases/input-invoices/page.tsx`).

| API | Quyền | Nguồn |
|---|---|---|
| GET `/api/input-invoices` (from,to,q,buyerTaxCode,seller,receiptStatus,page,size) | `inventory.view` | `IS/inputinvoice/InputInvoiceController.java:27,36-42` |
| GET `/api/input-invoices/{id}`, `/buyer-tax-codes` | `inventory.view` | :44-52 |
| POST `/api/input-invoices/import` (multipart `files`) | `inventory.manage` | :55-59 |
| PATCH `/api/input-invoices/{id}/receipt` | `inventory.manage` | :62-66 |
| GET/POST/PUT/DELETE `/api/tax-connections[/{id}]` | `inventory.manage` | `TaxConnectionController.java:29,46-67` |
| POST `/api/tax-connections/{id}/captcha`, `/sync` | `inventory.manage` | :69-77 |

2. **Dữ liệu**: `tax_connections` (tax_code UNIQUE, username, password_enc, active, last_synced_at, last_error); `input_invoices` UNIQUE `(seller_tax_code, template_no, series, number)`, nature `ORIGINAL|REPLACE|ADJUST`, source `PORTAL|XML`, `lines` JSON, `receipt_id/receipt_code` (`V1__init_integration_schema.sql:2-35`).
3. **Quy tắc**
   - Kết nối: tạo bắt buộc mật khẩu (400 `PASSWORD_REQUIRED`); MST trùng → 409 `TAX_CONNECTION_EXISTS`; sửa để trống mật khẩu = giữ; không thấy → 404 (`IS/inputinvoice/TaxConnectionService.java:41-60`). Xóa không báo 404 (:62-64).
   - Đồng bộ 2 bước: (1) POST captcha → GET `<GDT_PORTAL_URL>/captcha` trả `{key, svg}`; (2) sync gửi `captchaKey, captchaValue, from, to` (`TaxConnectionController.java:32-38`, `GdtPortalClient.java:44-47`). Người dùng tự nhập captcha (:27).
   - Khoảng ngày: `to < from` hoặc > 31 ngày → 400 `RANGE_INVALID` "Mỗi lần đồng bộ tối đa 1 tháng" (`TaxConnectionService.java:73-75`).
   - Đăng nhập `/security-taxpayer/authenticate` với mật khẩu giải mã; không có token / 4xx → 400 `GDT_LOGIN_FAILED` (`GdtPortalClient.java:50-66`).
   - Lấy hóa đơn mua vào ở cả `/query` (có mã) và `/sco-query` (máy tính tiền), lọc `tdlap` theo ngày, sort `tdlap:desc`, `size=50`, phân trang theo `state` (`GdtPortalClient.java:72-92`). Hóa đơn máy tính tiền nhận biết khi ký tự thứ 4 của ký hiệu là `M` → gọi detail `/sco-query` (`TaxConnectionService.java:83`).
   - Lỗi trong sync: ghi `last_error` rồi ném lại; thành công → `last_synced_at = now`, xóa lỗi; trả `{found, added}` (`TaxConnectionService.java:89-94`, `TaxConnectionRepository.java:58-64`). Lỗi HTTP cổng → 502 `GDT_ERROR` ("phiên có thể đã hết hạn"), mất kết nối → 502 `GDT_UNREACHABLE` (`GdtPortalClient.java:104-122`).
   - Nhập XML: mỗi file độc lập, lỗi ghi vào `errors` không chặn file khác; trả `{files, added, errors}` (`InputInvoiceService.java:44-58`). Chống XXE: tắt DOCTYPE, external entity, XInclude (`EInvoiceXmlParser.java:66-80`). Bắt buộc `TTChung`, `NBan`, `TToan` (`XML_NOT_EINVOICE`), `KHHDon`, `SHDon`, `NLap`, `MST` người bán (`XML_MISSING_<tag>`), `TgTTTBSo` (`XML_NO_TOTAL`) (:41-63,100-106). Giới hạn upload 20MB/file, 50MB/request (`IS-res/application.yml:19-20`).
   - Tính chất: XML `TCHDon` 1→REPLACE, 2→ADJUST, khác→ORIGINAL (`EInvoiceXmlParser.java:51-55`); cổng `tchat` 2→ADJUST, 3→REPLACE, khác→ORIGINAL (`InputInvoiceWriteRepository.java:63-68`).
   - Upsert idempotent theo khóa unique: mới → insert; đã có → cập nhật seller_name/totals (coalesce), `lines` chỉ ghi đè khi không rỗng, **giữ `receipt_*`** (`InputInvoiceWriteRepository.java:29-53`). Nguồn XML: `buyer_tax_code` lấy từ XML (thiếu → ""); nguồn cổng: MST của kết nối (`InputInvoiceService.java:50`, `TaxConnectionService.java:85`).
   - Danh sách: lọc ngày theo `issued_at`, `q` khớp số hóa đơn, `seller` khớp MST/tên, `receiptStatus` CREATED/NOT_CREATED; size 1…100; sắp `issued_at desc, number desc`; trả `total` và `sumTotal` (`InputInvoiceRepository.java:33-51`).
   - Lập phiếu nhập từ hóa đơn: FE tìm NCC theo MST, chưa có → tạo NCC mới từ người bán; điền số HĐ đầu vào, thuế suất ước lượng gần nhất trong 0/5/8/10% = vat/trước thuế; dòng hàng người dùng tự chọn (`FE/features/integrations/receipt-from-input-invoice.ts:10-26`, `integration-queries.ts:57-61`). Sau khi lưu phiếu → PATCH gắn `receiptId/receiptCode` (`FE/features/purchases/purchase-editor.tsx:53`).
4. **Bộ lọc/xuất**: sidebar kỳ, MST mua, người bán, trạng thái lập phiếu (`FE/features/integrations/input-invoice-filter-sidebar.tsx`). CSV: Ký hiệu, Số HĐ, Ngày, NCC, MST bán, MST mua, Tổng, trạng thái phiếu, tính chất (nhãn tiếng Việt cố định) (`input-invoices/page.tsx:56`, `integration-queries.ts:30`).
5. **Giới hạn**
   - Cổng thuế không có API công khai; đường dẫn là API nội bộ, **chưa kiểm chứng** với tài khoản thật (`GdtPortalClient.java:20-27`).
   - Xuất CSV chỉ trang đang hiển thị (`data.items`).
   - Không có đồng bộ tự động/định kỳ.

---

### 5.5 SePay – báo có chuyển khoản QR

1. **Route/API**: thiết lập `/settings/payments` (`FE/app/(admin)/settings/payments/page.tsx`); hộp thoại QR ở bán hàng (`FE/features/sales/qr-payment-dialog.tsx`).

| API | Quyền | Nguồn |
|---|---|---|
| GET `/api/payments/sepay/settings` | chỉ cần đăng nhập | `IS/payment/SePayController.java:55-58` |
| PUT `/api/payments/sepay/settings` | `settings.manage` | :61-65 |
| POST `/api/payments/sepay/webhook` | công khai (không JWT), xác thực API key | :71-80, `IS-res/application.yml:32` |
| POST `/api/payment-requests` | `sales.perform` hoặc `cashbook.manage` | :82-86 |
| GET `/api/payment-requests/{code}` | như trên | :88-92 |
| GET `/api/payments/transactions?limit` | `cashbook.manage` | :95-99 |

   - FE proxy `POST /api/payments/sepay/webhook` (Next route) chuyển nguyên header `Authorization` tới gateway, lỗi mạng → 502 `{success:false}` (`FE/app/api/payments/sepay/webhook/route.ts:8-20`).
2. **Dữ liệu**: `sepay_settings` (1 dòng; enabled, api_key_enc, auto_complete mặc định TRUE); `payment_requests` (code PK, amount, reference, branch_id, status `PENDING|PAID`, paid_amount, paid_at); `bank_transactions` (PK `sepay_id`, payment_code FK) (`V2__sepay_payments.sql:2-35`).
3. **Quy tắc**
   - Bật SePay khi chưa có key → 400 `SEPAY_KEY_REQUIRED` (`SePayService.java:56-63`).
   - Tạo yêu cầu: SePay phải bật (400 `SEPAY_DISABLED`); `amount ≥ 1000` (`@DecimalMin`), reference ≤ 100; mã `VXC` + 8 ký tự từ bảng chữ bỏ O/0, I/1, `SecureRandom` (`SePayController.java:39-41`, `SePayService.java:33-35,111-121`). FE chỉ tạo yêu cầu khi có `onPaid`, SePay bật và số tiền làm tròn ≥ 1000; nội dung QR là mã VXC (`qr-payment-dialog.tsx:58-62`).
   - Webhook (`SePayService.java:69-92`, `@Transactional`):

| Bước | Kết quả HTTP |
|---|---|
| Chưa bật / chưa có key | 503 `{success:false}` |
| Header `Authorization` (bỏ tiền tố `Bearer `/`Apikey `) ≠ key, so sánh hằng thời gian `MessageDigest.isEqual` | 401, log cảnh báo (không in key) |
| Thiếu `id` hoặc `transferAmount` | 400 |
| Hợp lệ | 200 `{success:true}` |

   - Khớp mã: chỉ khi `transferType = in`; tìm regex `VXC[A-Z0-9]{8}` trong `code` rồi `content` (viết hoa), chỉ nhận mã đã tồn tại (`SePayService.java:84,95-108`).
   - Idempotency: insert `bank_transactions` `on conflict (sepay_id) do nothing`; chỉ cộng tiền khi insert mới (SePay gửi lại không cộng 2 lần) (`SePayRepository.java:46-53`, `SePayService.java:88-90`). Nội dung cắt 500 ký tự (:86).
   - Cộng tiền: `paid_amount += amount`; đủ (`≥ amount`) → `PAID`, `paid_at = now()`; chuyển dư/nhiều lần vẫn cộng dồn (`SePayRepository.java:56-62`).
   - FE poll `GET /payment-requests/{code}` mỗi 3s tới khi PAID → toast + `onPaid(paidAmount, autoComplete)` (màn bán hàng tự hoàn thành nếu bật) (`qr-payment-dialog.tsx:41-53`).
   - Danh sách giao dịch: mới nhất trước, limit tối đa 500 (`SePayService.java:132-134`); FE lấy 50, tự làm mới 15s (`settings/payments/page.tsx:15-16`).
5. **Giới hạn**
   - FE không gửi `branchId` khi tạo yêu cầu → `branch_id` null (cảnh báo SEPAY_RECEIVED không gắn chi nhánh) (`qr-payment-dialog.tsx:62`).
   - Không có hết hạn yêu cầu thanh toán; giao dịch không khớp mã chỉ được lưu, không xử lý tiếp.
   - GET settings không giới hạn quyền (chỉ trả cờ).

---

### 5.6 Cảnh báo tích hợp (Hộp thư đến)

- Gửi sang identity-service qua `NotificationClient` (`/internal/notifications/sync` = đồng bộ trọn bộ theo loại, identity tự đóng cảnh báo không còn; `/internal/notifications` = sự kiện) (`backend/common-lib/.../notification/NotificationClient.java:47-53`).
- `EINVOICE_FAILED`: mỗi 15 phút (delay đầu 55s); mọi record FAILED (cũ nhất trước); dedupeKey `einvoice_failed:<invoiceId>`; nội dung lỗi cắt 500 ký tự; quyền `sales.perform`; tự đóng khi phát hành lại thành công (`IS/notification/IntegrationAlertJob.java:38-45,57-67`, `IntegrationAlertRepository.java:32-37`).
- `SEPAY_RECEIVED`: mỗi 60s, chỉ khi SePay bật; giao dịch khớp mã có `received_at > sepaySince`, tối đa 500; dedupeKey `sepay:<sepayId>`; theo chi nhánh của yêu cầu; dạng sự kiện không tự đóng; mốc `sepaySince` giữ trong bộ nhớ, khởi động lại → quét lại 24h (identity bỏ trùng theo dedupeKey) (`IntegrationAlertJob.java:17-21,31,47-54,70-93`, `IntegrationAlertRepository.java:47-54`).
- Chạy ngay: POST `/internal/notification-jobs/run` (quyền `internal` hoặc `settings.manage`), trả số đã gửi, -1 nếu gửi lỗi (`IntegrationAlertJobController.java:11-23`).

---

### 5.7 Outbox / luồng sự kiện giữa service

| Nguồn | Sự kiện → payload | Đích |
|---|---|---|
| product-service `CashflowOutbox` | Phiếu nhập hoàn thành có trả tiền NCC → CREATE PAYMENT `PC<mã phiếu nhập>`, category "Chi Tiền trả NCC", fund TRANSFER→BANK, khác→CASH (`PS/internal/CashflowOutbox.java:45-70`); hủy phiếu nhập đã trả → CANCEL (:72-82); phiếu chi trả nợ NCC → CREATE (fund TRANSFER→BANK, EWALLET→EWALLET, khác CASH) (:84-107); sửa → UPDATE (thời gian/người chi/ghi chú) (:110-121); hủy → CANCEL (:124-131). sourceType luôn `PURCHASE` | sales `POST /internal/cashflows` |
| identity-service `HrCashflowOutbox` | Thanh toán lương (sourceType `PAYROLL`, category "Chi trả lương nhân viên", fund BANK/CASH) và tạm ứng (`HR_ADVANCE`) → CREATE PAYMENT, partnerType EMPLOYEE; hủy → CANCEL (`ID/hr/HrCashflowOutbox.java:49-82`, `ID/hr/payroll/PayrollPaymentService.java:26,74,94`, `ID/hr/employee/EmployeeAdvanceService.java:51`) | sales `POST /internal/cashflows` |

- Ghi outbox **cùng transaction** nghiệp vụ (`Propagation.MANDATORY`); bảng `outbox_cashflows(id, payload, attempts, last_error, sent_at, created_at)` + index pending (`PS-res/db/migration/V3__internal_stock_docs.sql:12-21`; identity `V4__hr_schema.sql:189-198`).
- Gửi: job `@Scheduled(fixedDelay = app.outbox-delay-ms, mặc định 5000ms)`, lấy tối đa 50 bản ghi chưa gửi theo `created_at`; lỗi → `attempts+1`, `last_error`, **dừng ở bản ghi lỗi đầu tiên** để giữ thứ tự CREATE→CANCEL; không backoff, không giới hạn số lần thử (`PS/internal/CashflowOutbox.java:146-163`, `CashflowOutboxRepository.java:25-36`; `ID/hr/HrCashflowOutbox.java:93-109`).
- Nhận (`SS/cashbook/CashbookService.java:103-145`, quyền `internal` `SS/cashbook/CashbookController.java:112-116`): tra phiếu theo `(sourceType, sourceId)`; CANCEL → hủy nếu có; UPDATE → sửa occurredAt/collector/note nếu chưa hủy; CREATE đã có → bỏ qua; mới → tạo phiếu với `accounting = false` ("tiền hàng nhập đã vào giá vốn") (:139). Unique index `uq_cash_vouchers_source` chỉ cho `source_type IN ('INVOICE','PURCHASE')` (`SS-res/db/migration/V1__init_sales_schema.sql:135-137`) → 2 lần gửi song song của PURCHASE bị rollback và gửi lại.
- Phiếu tự động (`INVOICE, INVOICE_EXTRA, PURCHASE, RETURN, ORDER, DELIVERY`) không hủy tay được ở Sổ quỹ → 400 `VOUCHER_AUTO` (`CashbookService.java:84-91`); phiếu tay với NCC bị chặn `SUPPLIER_VOUCHER_VIA_SUPPLIER_SCREEN` (:56-60).
- Gọi đồng bộ khác: sales→product `POST /internal/products/tax-info` (≤ 500 id, chuỗi nhóm hàng đệ quy ≤ 20 cấp) (`PS/internal/InternalProductTaxController.java:20-35`, `ProductTaxInfoRepository.java:30-47`); sales→identity `GET /internal/settings/tax` (`ID/settings/TaxSettingsController.java:108-112`); lỗi → 503 `TAX_LOOKUP_DOWN` (`SS/invoice/TaxReductionLookupClient.java:52-74`); identity→sales `GET /internal/seller-revenue` (hoa hồng) (`ID/hr/commission/SellerRevenueClient.java:38`); integration→sales `/internal/invoices/{id}`; sales→integration `/internal/einvoices/*`.
- **Giới hạn**: phiếu PAYROLL/HR_ADVANCE không có unique index (chỉ kiểm tra tồn tại trước khi tạo); phiếu lương từ outbox `accounting=false` nên **không** vào cột "Chi phí lương" của Báo cáo tài chính (cột này chỉ lấy phiếu `accounting`) (`SS/report/FinanceReportRepository.java:20-21,45-47`). Bản ghi outbox lỗi vĩnh viễn chặn cả hàng đợi.

---

### 5.8 Giảm thuế GTGT (NQ 204/2025/QH15) – dữ liệu cho HĐĐT & sổ

- Áp dụng khi người bán bật "Giảm thuế" và ngày bán (giờ VN) trong 01/07/2025–31/12/2026 (`SS/invoice/InvoiceTaxReduction.java:24-25,46-49`, `TaxReductionPlanner.java:35-38`).
- Dòng đủ điều kiện do server tra (bỏ qua cờ máy bán gửi): DEDUCTION – hàng có cờ `tax_reduction` và mã `VAT10`; DIRECT – hàng có cờ và tỷ lệ % GTGT ngành > 0 (ngành theo nhóm hàng gần nhất đã gắn → ngành mặc định) (`TaxReductionPlanner.java:39-62`).
- Số giảm: doanh thu dòng sau phân bổ giảm giá HĐ; DEDUCTION = × 2/110; DIRECT = × tỷ lệ% × 20%; làm tròn 1 lần trên tổng (`InvoiceTaxReduction.java:52-68`). `total = subtotal − discount − taxReduction` (`SS/invoice/InvoiceMath.java:41-48`).
- Mã thuế dòng (`invoice_lines.tax_code`) lấy theo request bán hàng (`SS/invoice/InvoiceLineBuilder.java:49`); cờ `tax_reduced` theo kế hoạch server (:50).

---

### 5.9 Thiết lập thuế: ngành nghề, tỷ lệ, hồ sơ thuế (MST)

1. **Route/API**: FE `/settings/tax` (`FE/app/(admin)/settings/tax/page.tsx`); `GET /api/settings/tax` (đăng nhập), `PUT` quyền `settings.manage`, `GET /internal/settings/tax` (`ID/settings/TaxSettingsController.java:93-116`).
2. **Dữ liệu** (lưu key `tax` trong settings identity): `vatEnabled`, `sectors[{code ≤30, name ≤200, vatRate 0–20, pitRate 0–20}]`, `defaultSector`, `categorySectors{categoryId→sectorCode}`, `defaultTaxCode` (≤30), `profiles[{taxCode 10/12/13 số, name, revenueGroup 1–4, pitMethod REVENUE|PROFIT, active, locations[{code ≤10, name, address, province, ward, branchIds, startDate, active, provinceCode, wardCode}]}]`, `vatMethod DEDUCTION|DIRECT` (`TaxSettingsController.java:38-67`).
   - Nhóm doanh thu: 1 ≤ 1 tỷ/năm; 2 > 1–3 tỷ; 3 > 3–50 tỷ; 4 > 50 tỷ (:45).
   - Mặc định khi chưa lưu: vatEnabled=true, defaultSector `SAN_XUAT`, defaultTaxCode `HKD_KCT_15`, vatMethod `DEDUCTION`, 5 ngành (:76-83):

| Mã | Ngành | GTGT % | TNCN % |
|---|---|---|---|
| PHAN_PHOI | Phân phối, cung cấp hàng hóa | 1 | 0.5 |
| SAN_XUAT | Sản xuất, vận tải, dịch vụ có gắn với hàng hóa | 3 | 1.5 |
| DICH_VU | Dịch vụ, xây dựng không bao thầu NVL | 5 | 2 |
| CHO_THUE | Cho thuê tài sản, đại lý, nội dung số | 5 | 5 |
| KHAC | Hoạt động kinh doanh khác | 2 | 1 |

   - Mã thuế suất bán ra seed (chỉ đọc): `KCT, KKKNT, VAT0, VAT5, VAT8, VAT10, HKD_KCT_15` (`PS-res/db/migration/V1__init_product_schema.sql:116-123`).
3. **Validation khi lưu** (`TaxSettingsController.java:117-160`): ≥ 1 ngành (`SECTOR_REQUIRED`); mã ngành không trùng (`SECTOR_DUPLICATED`); ngành mặc định và ngành gắn nhóm hàng phải tồn tại (`SECTOR_NOT_FOUND`); MST không trùng (`TAX_CODE_DUPLICATED`); mã địa điểm không trùng trong 1 MST (`LOCATION_CODE_DUPLICATED`); 1 chi nhánh chỉ thuộc 1 địa điểm đang hoạt động của MST đang hoạt động (`BRANCH_IN_TWO_LOCATIONS`). Ghi audit "Thuế & Kế toán / Sửa".
   - Bản lưu cũ không có `sectors` → dùng 5 ngành mặc định; không có vatMethod → DEDUCTION (:99-104).
   - FE: thêm MST qua prompt, mặc định nhóm 2, REVENUE (`settings/tax/page.tsx`); nhóm 1 khóa lựa chọn cách tính TNCN (`FE/features/accounting/tax-profile-card.tsx:60`).

---

### 5.10 Sổ sách kế toán hộ kinh doanh (route `/accounting`)

**Khung trang** (`FE/app/(admin)/accounting/page.tsx`):
- Chọn MST (chỉ hồ sơ `active`), năm (3 năm gần nhất), Theo quý/Theo tháng, kỳ (:38,74-81). Không có hồ sơ → hướng dẫn tới `/settings/tax`.
- Chi nhánh của sổ = hợp `branchIds` các địa điểm đang hoạt động của MST (`FE/features/accounting/tax-queries.ts:39-40`).
- Doanh thu tải cả năm `from=YYYY-01-01&to=YYYY-12-31` (để tính lũy kế) (:44-46); chi phí chỉ tải khi TNCN theo thu nhập (:50-51).
- Mẫu sổ: nhóm 1 → `S1a-HKD`; REVENUE → `S2a-HKD`; PROFIT → `S2b-HKD` (:68). 4 tab: Tờ khai, Sổ doanh thu, Sổ kho S2d-HKD, Sổ tiền S2e-HKD (:85-103).
- Ngành của mặt hàng: nhóm hàng → nhóm cha gần nhất có gắn ngành (≤ 20 cấp) → ngành mặc định (`FE/features/accounting/tax-calc.ts:45-55`), nhóm hàng lấy từ `GET /api/accounting/stock/product-categories` (kể cả hàng đã xóa) (`PS/stock/StockBookController.java:29-33`).

#### 5.10.1 Sổ doanh thu (S1a/S2a/S2b) – API `/api/accounting/revenue/daily`
- Quyền `report.view` hoặc `cashbook.manage` (`SS/accounting/RevenueBookController.java:28-33`).
- Khoảng ngày `[from 00:00, to+1 00:00)` giờ VN; `branchIds` rỗng = **mọi chi nhánh** (`SS/accounting/RevenueBookRepository.java:83-91`).
- Dòng = ngày (giờ VN) × productId × taxCode (rỗng → '') (`RevenueBookRepository.java:37-70`):
  - `sales` = Σ round(`i.total` × SL × (đơn giá − giảm/đv) / `i.subtotal`) của hóa đơn `COMPLETED` theo `sold_at` (phân bổ giảm giá HĐ + giảm thuế theo tỷ lệ tiền hàng) (:46-47).
  - `returns` = Σ round(`r.total` × SL trả × đơn giá trả / `r.subtotal`) phiếu trả `COMPLETED` theo `returned_at`; `r.total = subtotal − discount − fee` (`SS/salesreturn/SalesReturnService.java:95-96`) → **phí trả hàng khách chịu nằm lại trong doanh thu** (:36).
  - `cogs` = Σ round(SL × giá vốn dòng bán) − Σ round(SL trả × giá vốn dòng gốc, thiếu thì giá vốn trên dòng trả).
  - `invoiceCount` = số hóa đơn distinct.
  - Mã thuế phiếu trả lấy theo dòng hóa đơn gốc (`il.tax_code`).
  - Hủy: chỉ chứng từ `COMPLETED`; hóa đơn/phiếu trả đã hủy bị loại.
- FE: lọc ngày trong kỳ, gom theo ngày × ngành; "chịu thuế" vs "không chịu thuế" theo mã thuế dòng (trống → `defaultTaxCode`); không chịu = `KCT`, `KKKNT`, `HKD_KCT*` (`FE/features/accounting/tax-calc.ts:16,58-59`, `revenue-book-tab.tsx:22-32`). Doanh thu thuần dòng = sales − returns.
- Cột/xuất: Ngày tháng, Diễn giải "Doanh thu bán hàng ngày …", Ngành nghề, DT chịu thuế GTGT, DT không chịu thuế GTGT, Tổng; dòng "Cộng"; In (window.print) + CSV `so-doanh-thu-<mẫu>-<từ ngày>.csv` (`revenue-book-tab.tsx:33-36,42-43`). Nội dung sổ/CSV luôn tiếng Việt.

#### 5.10.2 Chi phí khác – API `/api/accounting/revenue/expenses`
- Phiếu `PAYMENT`, `PAID`, `accounting = true`, partner ≠ SUPPLIER, source ∉ {RETURN, PURCHASE}, theo ngày giờ VN × category (`RevenueBookRepository.java:72-81`). Quyền như 5.10.1.

#### 5.10.3 Tờ khai thuế (tab Tờ khai) – tính ở FE (`FE/features/accounting/tax-calc.ts`)
- Ghi rõ là **ước tính**, kế toán xác nhận (:1-10).
- Nhóm 1 (`revenueGroup = 1`) → GTGT = 0, TNCN = 0 (:66, "group1Note").
- Mỗi kỳ (tháng/quý): `revenue` = Σ (sales − returns) trong kỳ; `cogs`; `expenses`; `cumulative` = lũy kế từ 01/01 (:68-73).
- GTGT ngành = round((DT ngành − DT không chịu thuế) × vatRate ngành / 100), chỉ khi `vatEnabled` và nhóm > 1 (:80).
- TNCN theo doanh thu: phần vượt ngưỡng 1 tỷ lũy kế phát sinh trong kỳ = max(0, cum − 1 tỷ) − max(0, before − 1 tỷ); chia cho ngành theo tỷ trọng doanh thu ngành trong kỳ (giả định); TNCN = round(cơ sở × pitRate / 100) (:11,75,81-82).
- TNCN theo thu nhập: cơ sở = max(0, revenue − cogs − expenses); thuế suất 15/17/20% cho nhóm 2/3/4 (:13,87-90).
- Tổng phải nộp = GTGT + TNCN (`tax-declaration-tab.tsx:25-31`).
- Cột: Doanh thu, DT chịu thuế, DT không chịu thuế, GTGT, (Giá vốn, Chi phí nếu PROFIT), Cơ sở TNCN/Thu nhập tính thuế, TNCN, Tổng phải nộp; dòng tổng năm; bảng chi tiết theo ngành của kỳ đang chọn. CSV `to-khai-thue-<MST>-<năm>.csv` (`tax-declaration-tab.tsx:32-33`).

#### 5.10.4 Sổ kho S2d-HKD – API `/api/accounting/stock/summary`
- Quyền `report.view` hoặc `inventory.view` (`PS/stock/StockBookController.java:35-40`); `branchIds` rỗng = mọi chi nhánh (`PS/stock/StockBookRepository.java:39-44`); ngày giờ VN → `[from, to+1)` (`StockBookService.java:28-30`).
- Từ `stock_ledger` (đơn vị cơ bản): giá trị = SL × `unit_price` với chứng từ NCC (`OPENING, PURCHASE, PURCHASE_CANCEL, PURCHASE_RETURN, PURCHASE_RETURN_CANCEL`), còn lại × `cost` lúc phát sinh. Tồn đầu = Σ trước from; Nhập = Σ quantity > 0 trong kỳ; Xuất = Σ |quantity < 0|; Cuối = đầu + nhập − xuất; bỏ hàng không có biến động (`StockBookRepository.java:45-70`).
- Cột: Mã hàng, Tên, ĐVT, SL/GT đầu kỳ, nhập, xuất, cuối kỳ; CSV `so-hang-hoa-S2d-<từ ngày>.csv` (`stock-and-cash-book-tabs.tsx:26-37`).

#### 5.10.5 Sổ tiền S2e-HKD (Sổ quỹ)
- Dùng `GET /api/cashbook?fund=CASH|BANK&from&to&statuses=PAID` (quyền `cashbook.manage` hoặc `report.view`) (`SS/cashbook/CashbookController.java:39-55`); FE gom tối đa 20 trang × 100 phiếu, sắp theo thời gian (`stock-and-cash-book-tabs.tsx:75-80`).
- Tồn đầu = Σ (thu − chi) phiếu `PAID` trước from cùng quỹ (+ chi nhánh nếu có); cuối = đầu + thu − chi (`SS/cashbook/CashbookRepository.java:73-75,90`). FE tính số dư lũy kế từng dòng.
- Chi nhánh: chỉ truyền `branchId` khi MST có đúng 1 chi nhánh; > 1 chi nhánh → lấy **mọi chi nhánh** và hiện cảnh báo (`stock-and-cash-book-tabs.tsx:72,98`).
- Cột: Ngày, Số hiệu, Diễn giải (loại thu chi − đối tượng), Thu, Chi, Tồn; CSV `so-tien-S2e-<quỹ>-<từ ngày>.csv`.

**Giới hạn sổ sách**
- `/accounting/revenue/*` và `/accounting/stock/summary` không giới hạn theo claim chi nhánh của JWT (khác các `/reports/**`).
- Sổ tiền nhiều chi nhánh lấy toàn cửa hàng; > 2.000 phiếu/kỳ bị cắt.
- Thuế tính ở trình duyệt, không lưu tờ khai.

---

### 5.11 Báo cáo – quy tắc chung

- Quyền: mọi `/api/reports/**` yêu cầu `report.view` (controller-level `@PreAuthorize`).
- Bộ lọc chung `ReportFilter` (`SS/report/ReportFilter.java:19-100`): `from,to` (Instant, `[from,to)`, thiếu hoặc from ≥ to → 400 `REPORT_RANGE_INVALID`); `branchIds` giao với claim `branches` JWT (rỗng = mọi chi nhánh được phép; giao rỗng → không ra dòng nào); `customerId, sellerId (= coalesce(seller_id, created_by) của HĐ), createdBy, methods (CASH/TRANSFER/CARD/EWALLET), saleModes (QUICK/NORMAL/DELIVERY), q (mã/tên hàng ilike), priceBookIds (UUID 0 = Bảng giá chung), channels, deliveryFrom/To` (:30-50,66-96). product-service dùng `ProductReportScope` cùng quy tắc (`PS/report/ProductReportScope.java:20-29`).
- **Ngày dùng để lọc** (không dùng created_at):

| Chứng từ | Cột ngày |
|---|---|
| Hóa đơn | `sold_at`, chỉ `status = COMPLETED` (`ReportFilter.java:53-55`) |
| Phiếu trả | `returned_at`, chỉ `COMPLETED` (:61-64) |
| Phiếu thu/chi | `occurred_at`, chỉ `PAID` |
| Đơn đặt hàng | `ordered_at`, mọi trạng thái trừ khi lọc |
| Phiếu nhập / trả hàng nhập | `received_at` / `returned_at`, `COMPLETED` |
| Xuất hủy | `issued_at`, `type = DAMAGE`, `COMPLETED` |
| Thẻ kho | `stock_ledger.occurred_at` |
| Công nợ | `occurred_at` của sổ |

- Phiếu trả: người bán/phương thức bán/bảng giá/kênh lọc theo hóa đơn gốc (LEFT JOIN) → phiếu "Trả nhanh" (không HĐ) bị loại khi lọc các tiêu chí đó; `customerId/createdBy/methods` theo chính phiếu trả (:57-64).
- Cắt ngày/tháng trong SQL theo `Asia/Ho_Chi_Minh` (:27).
- FE: `useReport` cache 30s, key = path + query (`FE/features/reports/report-api.ts:62-68`); mốc thời gian: Hôm nay, Hôm qua, Tuần này (thứ Hai), Tuần trước, 7 ngày qua, Tháng này, Tháng trước, 30 ngày qua, Quý này, Quý trước, Năm nay, Năm trước, hoặc tùy chỉnh (đảo nếu to < from) (`report-time-presets.ts:16-66`). Biểu đồ theo ngày; > 62 ngày → theo tháng; chỉ tới hôm nay (`report-time-presets.ts:73-84`, `summary-table-kit.tsx:58-67`).
- Xuất: CSV UTF-8 BOM, chặn công thức Excel (ô bắt đầu `= + - @` thêm `'`) (`FE/features/accounting/tax-calc.ts:97-108`); in qua iframe sandbox ẩn (`FE/features/reports/report-print.ts:1-4`).
- Định nghĩa chỉ số dùng chung (`FE/features/reports/summary-table-kit.tsx:17-21`): Doanh thu thuần = revenue − returnValue; Lợi nhuận gộp = thuần − giá vốn; Tỷ suất = lợi nhuận/thuần × 100 (2 chữ số) (`products-report-tables.tsx:23`).

### 5.12 Báo cáo bán hàng (`/reports/sales`)
- API `GET /api/reports/sales/summary?groupBy=DAY|SELLER|BRANCH|CUSTOMER|CHANNEL` (sai → 400 `REPORT_GROUP_INVALID`) (`SS/report/SalesSummaryReportController.java:30-35`, `SalesSummaryReportService.java:20-25`).
- Chỉ số mỗi nhóm (`SS/report/SalesSummaryReportRepository.java:57-72`):

| Chỉ số | Định nghĩa |
|---|---|
| invoiceCount / returnCount | số HĐ COMPLETED / phiếu trả COMPLETED |
| qty | Σ SL dòng hóa đơn (không trừ trả) |
| subtotal | Σ `i.subtotal` (tổng tiền hàng) |
| discount | Σ `i.discount` (giảm giá HĐ) |
| revenue | Σ `i.total` (sau giảm giá và giảm thuế) |
| returnValue | Σ (`r.subtotal − r.discount`) — **không trừ phí trả** |
| fee | Σ `r.fee` (phí trả hàng, cột riêng) |
| cogs | Σ round(SL × giá vốn) bán − Σ giá vốn hàng trả (giá vốn dòng gốc, thiếu → dòng trả) |

- Khóa nhóm: DAY = ngày giờ VN của sold_at/returned_at; SELLER = coalesce(seller, người tạo HĐ; trả nhanh → người tạo phiếu); CUSTOMER (không khách → "Khách lẻ"); CHANNEL (trả nhanh → `DIRECT`) (`SalesSummaryReportRepository.java:33-41`).
- FE mối quan tâm (`FE/features/reports/sales-report.tsx:20-23,52-68`): Thời gian (DAY: Doanh thu, Giá trị trả, Thuần), Lợi nhuận (DAY + Tổng tiền hàng, Giảm giá HĐ, Giá vốn, LN gộp), Nhân viên (SELLER), Chi nhánh (BRANCH); Giảm giá HĐ và Trả hàng dùng `/reports/end-of-day/sales` (lọc HĐ có discount > 0 / phiếu trả).
- Bộ lọc: Chi nhánh (1), Bảng giá, Thời gian, Phương thức bán, Kênh bán (`sales-report.tsx:85-95`). CSV `bao-cao-ban-hang-<concern>-<từ ngày>.csv`.

### 5.13 Báo cáo hàng hóa (`/reports/products`)
- `GET /api/reports/sales/products?by=NONE|CUSTOMER|SELLER&merge` (`SS/report/ProductSalesReportController.java:30-34`):
  - `revenue` dòng = round(`i.total` × SL × (đơn giá − giảm) / `i.subtotal`); `returnValue` dòng = round((`r.subtotal − r.discount`) × SL × đơn giá / `r.subtotal`); `cogs` như trên; `qtySold`, `qtyReturned` (`SS/report/ProductSalesReportRepository.java:53-66`).
  - `merge=true`: khóa theo product_id, SL quy về đơn vị cơ bản theo lô (`invoice_line_lots.base_qty`, thiếu → SL dòng), bỏ cột đơn vị; `false`: khóa theo product_code (mỗi ĐVT 1 dòng) (:49-52,74). Sắp theo thuần giảm dần.
- 8 mối quan tâm (`FE/features/reports/products-report.tsx:44-49`): Bán hàng, Lợi nhuận (NONE); Xuất nhập tồn (`/accounting/stock/summary`); XNT chi tiết (`/reports/inventory/movement-detail`); Xuất hủy (`/reports/inventory/damages`); Nhân viên/Khách hàng (by SELLER/CUSTOMER); NCC (`/reports/suppliers/summary?byProduct=true`).
- XNT chi tiết: thẻ kho theo hàng × `doc_type` (trước kỳ = `BEFORE`), cùng quy tắc giá trị S2d (`PS/report/InventoryReportRepository.java:34-46`). Xuất hủy: SL × hệ số quy đổi, giá trị = round(SL × unit_cost), số phiếu (:49-60).
- Lọc nhóm hàng (gồm nhóm con) và tìm hàng ở FE cho các nguồn kho/NCC (`products-report.tsx:55,68`); "Gộp theo nhóm hàng". Biểu đồ Top 10 (bỏ giá trị ≤ 0) (`summary-table-kit.tsx:76`).
- Giới hạn: mối quan tâm Xuất nhập tồn gọi `/accounting/stock/summary` — không giới hạn chi nhánh JWT; ngày gửi là ngày máy.

### 5.14 Báo cáo cuối ngày (`/reports/end-of-day`)
- `GET /api/reports/end-of-day/sales` và `/cashflow?funds=CASH|BANK|EWALLET` (`SS/report/EndOfDayReportController.java:30-40`).
- Bán hàng (`SS/report/EndOfDayReportRepository.java:45-83`):
  - HĐ: revenue = `i.total`; paid = Σ phân bổ phiếu thu `PAID` **có occurred_at trong kỳ** (`voucher_allocations`); debt = revenue − paid; method chỉ hiện khi paid > 0; bankLabel = "Ngân hàng - số TK - chủ TK" của phiếu thu đầu tiên có tài khoản (:47-63).
  - Phiếu trả: số âm (qty, subtotal, discount, revenue = −(subtotal − discount)); fee dương; paid = −tiền chi trả khách (`source_type = RETURN`, PAID, trong kỳ); debt = refunded − total (:64-81).
- Thu chi: phiếu `PAID` trong kỳ; lọc partner (= khách), collector (= nhân viên), người tạo, quỹ (:86-99). FE đổi phương thức → quỹ: CASH→CASH, TRANSFER/CARD→BANK, EWALLET→EWALLET (`FE/features/reports/end-of-day-report.tsx:21`).
- Hàng hóa: `/reports/sales/products`.
- Tổng hợp (`FE/features/reports/end-of-day-other-lines.tsx:80-105`): Hóa đơn (số, Σ doanh thu), Trả hàng, Phí trả, Thuần = Σ revenue (HĐ + trả âm), Thực thu, Ghi nợ; Thu, Chi, Tiền mặt/NH/Ví = thu − chi theo quỹ; Số mặt hàng, thuần hàng hóa, SL bán, SL trả.
- Thời gian: 1 ngày + giờ từ/đến (đến + 1 phút) hoặc khoảng ngày (`report-time-filter.tsx:76-85`); hiển thị dọc/ngang (ngang tách theo phương thức TM/CK/Thẻ/Ví/Ghi nợ và tài khoản). Thu khác/VAT/Làm tròn luôn 0 (`end-of-day-sales-lines.tsx:1-5`).

### 5.15 Báo cáo tài chính – Kết quả kinh doanh (`/reports/finance`)
- `GET /api/reports/finance` theo tháng giờ VN (`SS/report/FinanceReportController.java:13-22`, `FinanceReportRepository.java:30-63`) + product-service `/reports/inventory/damages/monthly` và `/reports/suppliers/payment-discounts/monthly` gộp theo tháng ở FE (`FE/features/reports/finance-report.tsx:77-86`).

| Cột API | Định nghĩa |
|---|---|
| sales | Σ `i.subtotal` HĐ COMPLETED |
| invoiceDiscount | Σ `i.discount` |
| returnValue | Σ (`r.subtotal − r.discount`) |
| cogs | giá vốn bán − giá vốn trả |
| returnFee | Σ `r.fee` |
| paymentDiscount | −Σ `customer_debt_ledger.amount` loại DISCOUNT (**không lọc chi nhánh**) (:42-43) |
| salary | phiếu chi PAID `accounting`, category chứa "lương", trừ NCC/RETURN/PURCHASE (:20-21,45-47) |
| otherExpense | phiếu chi như trên, category không chứa "lương" |
| otherIncome | phiếu thu PAID `accounting` (:49-50) |
| deliveryFee | −Σ `delivery_partner_ledger` FEE (phí giao hàng cửa hàng chịu) (:52-53) |
| damage (PS) | Σ round(SL × unit_cost) xuất hủy DAMAGE COMPLETED (`PS/report/InventoryReportRepository.java:63-71`) |
| supplierDiscount (PS) | Σ `supplier_debt_docs` DISCOUNT ACTIVE (`PS/report/SupplierPaymentDiscountReportRepository.java:21-29`) |

- Công thức dòng (`finance-report.tsx:29-54`): Doanh thu thuần = sales − invoiceDiscount − returnValue; LN gộp = thuần − cogs; Chi phí = damage + paymentDiscount + salary + deliveryFee; LN hoạt động = gộp − chi phí; Thu nhập khác = returnFee + otherIncome + supplierDiscount; LN thuần = LN hoạt động + thu nhập khác − otherExpense. Voucher, hoàn tiền khách, thanh toán điểm, làm tròn luôn 0.
- Hiển thị: năm (6 năm) theo tháng/quý + cột Tổng, hoặc khoảng ngày (mặc định đầu tháng→hôm nay); lọc chi nhánh. Ngôn ngữ ≠ vi hiện kèm thuật ngữ tiếng Việt. CSV `bao-cao-tai-chinh-<từ ngày>.csv`.
- Giới hạn: lương trả qua HR outbox không vào (5.7); giảm thuế không có dòng riêng (sales dùng subtotal, thuần = subtotal − discount − returns nên không trừ taxReduction).

### 5.16 Báo cáo đặt hàng (`/reports/orders`)
- `GET /api/reports/orders/products?statuses&merge` và `/transactions?statuses` (`SS/report/OrderReportController.java:30-40`).
- Lọc `ordered_at`, chi nhánh, khách, người tạo, trạng thái (rỗng = mọi trạng thái, gồm đơn hủy), bảng giá, kênh, thời gian giao (`expected_delivery_at`) (`OrderReportRepository.java:61-68`).
- Theo hàng: SL đặt, số đơn, giá trị = round(`o.total` × SL × (giá − giảm) / `o.subtotal`), "SL đã tạo hóa đơn" = SL của đơn `COMPLETED` (:34-46). Theo giao dịch: từng đơn với SL, subtotal, discount, total, deposit, mã hóa đơn (:48-59).
- Mốc giao hàng FE: Hôm nay, Ngày mai, 7 ngày tới, Tháng này, Quá hạn (to = now) (`FE/features/reports/report-filter-options.ts:34-45`).

### 5.17 Báo cáo khách hàng / nhân viên / kênh bán (`/reports/customers|employees|channels`)
- Dùng chung `PartyReport` (`FE/features/reports/party-report-configs.ts:5-36`): Khách hàng (groupBy CUSTOMER: Bán hàng, Hàng bán theo khách, Công nợ, Lợi nhuận); Nhân viên (SELLER: Bán hàng, Lợi nhuận, Hàng bán theo NV); Kênh bán (CHANNEL, biểu đồ tròn: Bán hàng, Lợi nhuận).
- Công nợ khách: `GET /api/reports/customers/debt?from&to&customerId` — **toàn cửa hàng** (sổ công nợ không tách chi nhánh); nợ đầu kỳ = Σ amount trước from; ghi nợ = Σ amount > 0 trong kỳ; ghi có = Σ |amount < 0|; cuối = đầu + nợ − có; chỉ khách có đầu kỳ ≠ 0 hoặc phát sinh (`SS/report/CustomerDebtReportController.java:13-31`, `CustomerDebtReportRepository.java:31-48`).

### 5.18 Báo cáo nhà cung cấp (`/reports/suppliers`)
- `GET /api/reports/suppliers/summary?byProduct` và `/debt` (product-service) (`PS/report/SupplierReportController.java:34-45`).
- Giá trị nhập/trả = tổng phiếu (sau giảm giá, gồm VAT) phân bổ theo tỷ lệ tiền hàng; SL đơn vị cơ bản; số phiếu nhập; NCC null → "Không có nhà cung cấp" (`SupplierReportRepository.java:27-60`).
- Công nợ NCC: ghi nợ = tổng phiếu nhập; ghi có = (tổng trả hàng nhập − NCC đã hoàn) + thanh toán + chiết khấu; điều chỉnh dương → nợ, âm → có; chỉ chứng từ COMPLETED / docs ACTIVE; theo chi nhánh lập phiếu (:63-87).

### 5.19 Doanh thu theo người bán (hoa hồng – nội bộ)
- `GET /internal/seller-revenue?from&to` (quyền `internal`) (`SS/accounting/SellerRevenueInternalController.java:25-29`).
- Chỉ HĐ có `seller_id`; netRevenue = phân bổ như 5.10.1; paidRevenue = net × min(1, `i.paid/i.total`); trả hàng quy về người bán HĐ gốc, "Trả nhanh" → người lập phiếu và tính đủ thực thu (`SellerRevenueRepository.java:32-65`). Không lọc chi nhánh.

---

### 5.20 Dashboard Tổng quan (route `/`)

1. **Mục đích**: KQ bán hàng hôm nay, doanh thu thuần theo ngày/giờ/thứ, Top 10 hàng bán chạy, hoạt động gần đây (`FE/features/dashboard/dashboard-page-content.tsx:1-61`).
2. **Nguồn dữ liệu / quyền**:

| Widget | API | Quyền FE |
|---|---|---|
| Doanh thu / trả / % thay đổi, biểu đồ ngày & thứ, Top 10 | `/accounting/revenue/daily` 1 lần cho đầu tháng trước → hôm nay, không truyền chi nhánh (`dashboard-queries.ts:15-21`) | `report.view` hoặc `cashbook.manage` (không có → chỉ lời chào, vai trò, chi nhánh) |
| Số hóa đơn hôm nay | `/invoices?statuses=COMPLETED&size=1` lấy `total` (`dashboard-queries.ts:24-32`) | `sales.perform` hoặc `report.view` |
| Theo giờ | duyệt `/invoices` 100/trang, tối đa 20 trang; > 2.000 HĐ → báo chọn khoảng ngắn hơn; cộng `total` theo giờ máy của `soldAt` (`dashboard-queries.ts:35-53`) | như trên |
| Hoạt động gần đây | `/audit-logs?size=10`, làm mới 60s (`dashboard-queries.ts:56-62`) | `user.manage` |

3. **Công thức** (`today-sales-summary-card.tsx`, `revenue-chart-card.tsx`, `top-products-card.tsx`):
   - Doanh thu hôm nay = Σ `sales` ngày hôm nay (đã phân bổ giảm giá HĐ); Trả hàng = Σ `returns`; Thuần = sales − returns.
   - % so hôm qua / cùng ngày tháng trước (31/3 → 28|29/2) = (thuần nay − thuần mốc)/|thuần mốc| × 100, 2 chữ số; mốc = 0 → "—" (`dashboard-date-utils.ts:21-24`).
   - Doanh thu thuần theo kỳ (Hôm nay, Hôm qua, 7 ngày qua, Tháng này, Tháng trước): tổng + cột theo ngày / theo thứ (T2…CN) / theo giờ. Theo giờ dùng `i.total` hóa đơn, **chưa trừ trả hàng**.
   - Top 10: gom thuần theo productId trong kỳ (mặc định Tháng này), bỏ ≤ 0, tên hàng tải `/products/{id}`.
   - Rút gọn tiền trục: ≥1e9 "tỷ", ≥1e6 "tr", ≥1e3 "k" (`dashboard-date-utils.ts:62-68`).
5. **Giới hạn**: không có bộ lọc chi nhánh; `/accounting/revenue/daily` không giới hạn chi nhánh JWT → doanh thu là toàn cửa hàng trong khi comment ghi "mọi chi nhánh người dùng được xem" (`dashboard-queries.ts:14`); ngày theo giờ máy; Theo giờ khác định nghĩa với các widget khác (không trừ trả).

---

### 5.21 Khác (tìm thấy khi đọc)
- Gateway webhook công khai chỉ 1 đường `/api/payments/sepay/webhook` (`IS-res/application.yml:30-32`).
- Thống kê giao hàng/dòng tiền đối tác giao hàng nằm ở `SS/delivery/ShipmentDashboardRepository.java:5-8` (ngoài phạm vi phần này).
- Danh sách mẫu sổ/tờ khai và nhãn sổ luôn tiếng Việt ở mọi ngôn ngữ (`FE/app/(admin)/accounting/page.tsx` doc comment, `revenue-book-tab.tsx:12-16`).

---

### Câu hỏi chưa giải quyết
- Dashboard và Sổ doanh thu tính phí trả hàng vào doanh thu thuần, còn Báo cáo bán hàng/tài chính tách phí trả thành cột riêng — có chủ ý không?
- `/accounting/revenue/*`, `/accounting/stock/summary`, `/reports/customers/debt`, `paymentDiscount` không giới hạn chi nhánh người dùng — có chủ ý không?
- Phiếu lương/tạm ứng từ HR outbox có `accounting=false` nên không vào "Chi phí lương" của báo cáo tài chính — có đúng ý đồ không?
- Mã tính chất hóa đơn đầu vào: XML (`TCHDon` 1=thay thế, 2=điều chỉnh) và cổng (`tchat` 2=điều chỉnh, 3=thay thế) dùng hai bảng mã khác nhau — chưa kiểm chứng với dữ liệu thật.


---

