package com.vaxclinic.sales.channel;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Ghi bảng sales_channels (thêm / sửa / xóa) và đếm chứng từ đang dùng kênh. Đọc danh sách ở {@link SalesChannels}. */
@Repository
public class SalesChannelRepository {

    private final JdbcTemplate jdbc;

    public SalesChannelRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Số tiếp theo của sequence mã kênh (CH001, CH002...). */
    public Long nextCodeNumber() {
        return jdbc.queryForObject("select nextval('sales_channel_code_seq')", Long.class);
    }

    /** Ném DuplicateKeyException khi trùng tên. */
    public void insert(String code, String name, boolean active, int sortOrder) {
        jdbc.update("insert into sales_channels(code, name, active, sort_order) values (?,?,?,?)", code, name, active, sortOrder);
    }

    /** Ném DuplicateKeyException khi trùng tên. */
    public void update(String code, String name, boolean active, int sortOrder) {
        jdbc.update("update sales_channels set name = ?, active = ?, sort_order = ? where code = ?", name, active, sortOrder, code);
    }

    /** Số hóa đơn + đơn đặt hàng đã bán qua kênh. */
    public Integer countUsage(String code) {
        return jdbc.queryForObject("select (select count(*) from invoices where sales_channel = ?)"
                + " + (select count(*) from customer_orders where sales_channel = ?)", Integer.class, code, code);
    }

    public void delete(String code) {
        jdbc.update("delete from sales_channels where code = ?", code);
    }
}
