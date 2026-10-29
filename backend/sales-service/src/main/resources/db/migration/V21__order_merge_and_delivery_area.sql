-- Đặt hàng: "Gộp đơn" (đơn gốc bị hủy trỏ sang đơn gộp) + khu vực giao hàng (Tỉnh/Thành, Phường/Xã) để lọc danh sách.
alter table customer_orders add column merged_into_id uuid references customer_orders (id);
alter table customer_orders add column receiver_province varchar(100);
alter table customer_orders add column receiver_province_code varchar(10);
alter table customer_orders add column receiver_ward varchar(100);
alter table customer_orders add column receiver_ward_code varchar(10);

-- Đơn đã có: lấy khu vực theo địa chỉ khách hàng
update customer_orders o set receiver_province = c.province, receiver_province_code = c.province_code,
  receiver_ward = c.ward, receiver_ward_code = c.ward_code
from customers c where c.id = o.customer_id;

create index ix_customer_orders_area on customer_orders (receiver_province_code, receiver_ward_code);
