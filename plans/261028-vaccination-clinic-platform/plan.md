# Plan: Hệ thống quản lý kinh doanh vắc xin & dịch vụ tiêm chủng (nội bộ 1 doanh nghiệp)

Status: IN PROGRESS — Phase 01 đang code. Tham chiếu chức năng quản lý bán hàng/kho kiểu KiotViet, nghiệp vụ lõi theo quy trình tiêm chủng dịch vụ.

## Quyết định đã chốt (từ user, 2026-10-28)
- Ngành: kinh doanh vắc xin + dịch vụ tiêm chủng. Nội bộ 1 doanh nghiệp, nhiều điểm tiêm (chi nhánh) → **không multi-tenant**.
- Web trước (Next.js), POS/quầy **chạy được khi mất mạng** (offline-first: IndexedDB + hàng đợi đồng bộ).
- Giao diện: code đến màn nào → dừng, xin user ảnh chụp màn hình để làm theo bố cục.
- Tích hợp ngoài: thiết kế dạng **provider có thể chọn trong Thiết lập** (HĐĐT, QR thanh toán, SMS/ZNS, hệ thống tiêm chủng quốc gia).
- Thiết bị: in phiếu K80 + A4/A5 qua trình duyệt, máy quét mã vạch dạng bàn phím, in tem mã vạch (chuẩn phổ biến).

## Quy trình nghiệp vụ lõi (1 lượt khách đến tiêm)
```
Tiếp đón ─▶ Khám sàng lọc ─▶ Chỉ định vắc xin ─▶ Thu ngân ─▶ Tiêm ─▶ Theo dõi sau tiêm (≥30') ─▶ Hẹn mũi tiếp
 (hồ sơ,     (sinh hiệu,       (theo phác đồ,      (bán lẻ mũi/  (quét lô,  (ghi nhận phản ứng       (tự sinh lịch
  người giám  phiếu sàng lọc,   tuổi, khoảng cách   gói, cọc,     đúng người, sau tiêm – AEFI)        theo phác đồ,
  hộ, số thứ  kết luận: đủ ĐK / mũi, mũi đã mua)    nhiều PTTT)   trừ kho                              nhắc SMS/ZNS)
  tự)         tạm hoãn / CCĐ)                                     FEFO)
```

## Kiến trúc service (Java 17, Spring Boot 3.3, PostgreSQL mỗi service 1 DB)
| Service | Port | Phạm vi |
|---|---|---|
| gateway | 8080 | routing, verify JWT |
| identity | 8081 | user, vai trò/quyền, điểm tiêm (chi nhánh), đăng nhập JWT |
| product | 8082 | hàng hóa + kho (gộp): nhóm hàng, đơn vị quy đổi, thuế, hàng theo lô/HSD hoặc không, tồn theo điểm tiêm, thẻ kho, FEFO, giá vốn bình quân. Sau: phác đồ, gói tiêm, chuyển kho, kiểm kho |
| patient | 8084 | khách hàng/người tiêm, người giám hộ, lịch sử tiêm (cả nơi khác), mũi đã mua chưa tiêm, lịch hẹn |
| clinical | 8085 | lượt khám, hàng đợi theo phòng, sàng lọc, chỉ định, ghi nhận tiêm, theo dõi sau tiêm, AEFI |
| sales | 8086 | thu ngân POS (offline), hóa đơn, cọc, hoàn tiền, sổ quỹ, công nợ NCC |
| report | 8087 | dashboard, doanh thu, số mũi, xuất-nhập-tồn theo lô, cận date, AEFI |
| integration | 8088 | provider HĐĐT / QR / SMS-ZNS / hệ thống TCQG, webhook |

Hạ tầng: PostgreSQL 16, Redis, RabbitMQ (event + outbox), MinIO. Docker Compose.
FE: Next.js 15 (App Router) + Tailwind + shadcn/ui + TanStack Query, BFF route handler giữ JWT trong cookie httpOnly.

## Phases
| # | Phase | Status |
|---|---|---|
| 1 | Nền tảng: repo, docker, gateway, identity, FE shell + đăng nhập | done (thiếu test tự động) |
| 2 | [Hàng hóa + kho](phase-02-products-and-stock.md) | **in progress** — core xong |
| 3 | [Mua hàng](phase-03-purchasing.md): NCC, phiếu nhập (theo lô), trả hàng nhập | **in progress** — core xong; hóa đơn đầu vào chờ chốt cách đồng bộ |
| 4 | [Bán hàng, khách hàng, hóa đơn, sổ quỹ, công nợ](phase-04-sales-customers-cashbook.md) | **in progress** — đợt 1 xong |
| 4b | [Tích hợp thuế: hóa đơn đầu vào (cổng thuế/XML), HĐĐT MISA](phase-05-tax-integrations.md) | code xong — chờ thử tài khoản thật |
| 5 | Quy trình: tiếp đón → sàng lọc → chỉ định → tiêm → theo dõi | todo — cần ảnh UI |
| 6 | Thu ngân POS offline, sổ quỹ | todo — cần ảnh UI |
| 7 | Báo cáo & dashboard | todo |
| 8 | Nhắc lịch, tích hợp provider (HĐĐT, QR, SMS/ZNS, TCQG) | todo |

## Lưu ý pháp lý (cần doanh nghiệp xác nhận văn bản hiện hành)
- Cơ sở tiêm chủng phải đủ điều kiện theo quy định hoạt động tiêm chủng (NĐ 104/2016/NĐ-CP và văn bản sửa đổi, hướng dẫn khám sàng lọc của Bộ Y tế). Phần mềm hỗ trợ ghi nhận, không thay thế trách nhiệm chuyên môn.
- Dữ liệu sức khỏe là dữ liệu cá nhân nhạy cảm → phân quyền chặt, nhật ký truy cập, sao lưu.
