package com.vaxclinic.integration.einvoice;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Request / response của API hóa đơn điện tử (MISA meInvoice). */
public final class EInvoiceDtos {

    private EInvoiceDtos() {
    }

    public record SettingsRequest(@Pattern(regexp = "TEST|PROD") String environment, @NotBlank(message = "Nhập AppID MISA cấp") String appId,
                                  @NotBlank(message = "Nhập mã số thuế") String taxCode, @NotBlank String username, String password,
                                  @NotBlank(message = "Nhập ký hiệu hóa đơn") String invSeries, @NotBlank String invoiceName,
                                  boolean sendEmail) {
    }
}
