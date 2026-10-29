package com.vaxclinic.identity.notification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/** DTO thông báo nội bộ (tab "Cập nhật" của Hộp thư đến). */
public final class AnnouncementModels {

    private AnnouncementModels() {
    }

    /** link: đường dẫn trong ứng dụng (/products...) hoặc địa chỉ http(s) bên ngoài; bỏ trống = không có link. */
    public record AnnouncementRequest(@NotBlank(message = "Nhập tiêu đề") @Size(max = 300) String title,
                                      @Size(max = 5000) String body, @Size(max = 500) String link) {
    }

    public record Announcement(long id, String title, String body, String link, String createdByName,
                               Instant createdAt, Instant updatedAt) {
    }
}
