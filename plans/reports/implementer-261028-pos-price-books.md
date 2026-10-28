# POS: bảng giá (price books) trên màn bán hàng — báo cáo (2026-10-28)

Frontend only. Không đụng backend, features/sales/* report, app-header-nav-menu, features/reports, features/employees.

## Hành vi
- Danh mục: `GET /products/pos-catalog?branchId=…&withPriceBooks=true` → `{products, priceBooks}`; lưu `{at, items, priceBooks}` vào `pos.catalog.<branch>` (localStorage như cũ) → offline vẫn có bảng giá. Đọc được bản lưu cũ `{at, items}` và mảng trần; server trả mảng (chưa cập nhật) → priceBooks = [].
- Mỗi tab hóa đơn / đặt hàng có `priceBookId` (null = Bảng giá chung). Tab trả hàng không dùng.
- Ô chọn "Bảng giá chung ▾" (native select nhỏ, chữ xanh) nằm bên phải ô khách hàng ở đầu cột thanh toán. Options = `applicablePriceBooks` theo chi nhánh, nhóm khách, người bán, lúc này.
- Đổi khách / người bán / tab, bảng giá không còn áp dụng (hoặc bị xóa / hết hạn) → về Bảng giá chung, toast info, giá các dòng được tính lại. Chỉ chạy khi danh mục đã tải xong, nên tab đã lưu không bị reset lúc mới mở trang.
- Thêm hàng: `resolvePrice` → allowed=false: không thêm + toast warning; có warning: thêm + toast; còn lại lấy giá bảng giá. Hàng đã có trong giỏ thì chỉ +1 số lượng (không tính lại giá).
- Đổi bảng giá: tính lại các dòng có `priceEdited=false`, giảm giá dòng bị kẹp ≤ giá mới. Hàng bị bảng giá BLOCK chặn → **bỏ khỏi giỏ** và báo tên hàng. Cảnh báo được gộp theo nội dung, kèm tên các hàng.
- `priceEdited=true` khi: sửa ô Đơn giá, "Áp dụng giá bán" (giá gần nhất), và mọi dòng mở từ hóa đơn / đơn đã lưu (`?edit=`, `?order=`, `?orderInvoice=`). Đổi đơn vị tính thì lấy lại giá theo bảng giá (BLOCK → không đổi đơn vị) và reset `priceEdited=false`.
- Tab đã lưu cũ: `migrateDraft` khi load (thiếu priceBookId → null, thiếu priceEdited → false).
- Nhóm khách: thêm `groupId` vào `PosCustomer` (lấy từ danh sách khách / khách mới tạo, lưu cache khách). Hóa đơn / đơn đã lưu không có nhóm → lấy từ cache khách trên máy (`cachedCustomerGroupId`).

## Files
Tạo (features/pos/):
- `pos-catalog-response.ts` (pure)
- `pos-price-book-pricing.ts` (pure: context, resolveUnitPrice, priceBookDropped, repriceLines, migrateDraft)
- `use-pos-price-book.ts` (hook)
- `pos-price-book-select.tsx`
- `pos-add-product.ts` (addProduct tách khỏi pos-screen)

Sửa: `use-pos-catalog.ts`, `pos-types.ts`, `use-pos-tabs.ts`, `pos-open-invoice.ts`, `pos-open-order.ts`, `pos-customer-picker.tsx`, `pos-cart.tsx`, `pos-cart-line.tsx`, `pos-checkout-panel.tsx`, `pos-screen.tsx` (202 → 187 dòng).

## Kiểm thử
- `npx tsc --noEmit -p .` sạch; `npx eslint src/features/pos src/features/products/price-book-resolver.ts` sạch.
- Test node mới `scratchpad/pos-price-book-pricing.test.ts` (6/6 pass). Chạy bằng `node --experimental-strip-types --import ./ts-ext-register.mjs --test pos-price-book-pricing.test.ts` trong scratchpad. Hook nhỏ `ts-ext-resolve-hook.mjs` thêm `.ts` cho import không có đuôi, vì file nguồn import resolver không ghi đuôi. `price-book-resolver.test.ts` vẫn 5/5.
- Chưa test trên trình duyệt (không chạy dev/build).

## Test tay
1. Tạo bảng giá "Sỉ" (Áp dụng, chi nhánh hiện tại, nhóm khách G) có giá cho hàng A. Mở /pos, ô "Bảng giá chung ▾" chưa có "Sỉ". Chọn khách thuộc nhóm G thì "Sỉ" xuất hiện.
2. Thêm A rồi chọn "Sỉ": giá A đổi theo bảng. Sửa tay đơn giá A, đổi về Bảng giá chung: giá tay được giữ. Thêm hàng B không có trong bảng: ALLOW thì giá chung, WARN thì toast, BLOCK thì không thêm được + toast.
3. Đang ở "Sỉ", bỏ chọn khách (hoặc đổi người bán khi bảng giá giới hạn người bán): toast "chuyển về Bảng giá chung", giá được tính lại.
4. Đổi đơn vị tính của một dòng: giá theo bảng của đơn vị mới.
5. Tải lại trang: tab giữ bảng giá và giá. Ngắt mạng, tải lại: bảng giá vẫn có (lấy từ cache).
6. /pos?edit=<HĐ>: dòng giữ giá cũ; đổi bảng giá không làm đổi giá các dòng đó, chỉ hàng thêm mới lấy giá bảng.

## Câu hỏi mở
- BLOCK khi đổi bảng giá: đang bỏ hàng ngoài bảng khỏi giỏ (chỉ dòng chưa sửa giá tay). Có muốn hỏi xác nhận trước khi bỏ không?
- Khách trong cache cũ (trước thay đổi này) chưa có groupId. Hóa đơn / đơn mở lại với khách đó chỉ thấy bảng giá không giới hạn nhóm, cho tới khi khách được tìm lại online.
- Chưa lưu priceBookId lên hóa đơn (cần field ở sales-service), như báo cáo backend đã nêu.
