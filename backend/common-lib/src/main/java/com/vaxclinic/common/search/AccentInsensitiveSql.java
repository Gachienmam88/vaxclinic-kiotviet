package com.vaxclinic.common.search;

/**
 * Điều kiện SQL tìm kiếm không phân biệt dấu / hoa thường (gõ "vac xin" ra "Vắc xin", "duong" ra "Đường").
 * Cần hàm {@code immutable_unaccent(text)} (bọc extension unaccent, khai báo IMMUTABLE để dùng được trong chỉ mục) và
 * chỉ mục GIN trigram trên đúng biểu thức {@code immutable_unaccent(lower(cột))} — tạo bằng migration Flyway của từng
 * service (V*__accent_insensitive_search.sql). Giá trị tham số vẫn là mẫu LIKE ("%q%"), escape như ILIKE trước đây.
 */
public final class AccentInsensitiveSql {

    private AccentInsensitiveSql() {
    }

    /** {@code immutable_unaccent(lower(column)) like immutable_unaccent(lower(param))}; param VD ":q" hoặc "?". */
    public static String like(String column, String param) {
        return "immutable_unaccent(lower(" + column + ")) like immutable_unaccent(lower(" + param + "))";
    }
}
