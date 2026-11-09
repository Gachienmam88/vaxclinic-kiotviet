package com.vaxclinic.integration.einvoice.client;

import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.security.ServiceTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** sales-service (/internal): dữ liệu hóa đơn bán để phát hành hóa đơn điện tử. */
@Component
public class SalesInvoiceClient {

    public record SalesInvoice(UUID id, String code, String status, Instant soldAt, String paymentMethod,
                               BigDecimal subtotal, BigDecimal discount, BigDecimal total, Buyer buyer, List<Line> lines) {
        public record Buyer(String code, String fullName, String legalName, String taxCode, String address, String email,
                            String phone, String idNumber) {
        }

        public record Line(int lineNo, String productCode, String productName, String unitName, BigDecimal quantity,
                           BigDecimal unitPrice, BigDecimal discount, String taxCode) {
        }
    }

    private final RestClient sales;
    private final ServiceTokenProvider tokens;

    public SalesInvoiceClient(InternalRestClientFactory httpFactory, @Value("${app.sales-url}") String salesUrl,
                              @Value("${app.jwt.secret}") String secret) {
        this.sales = httpFactory.create(salesUrl);
        this.tokens = new ServiceTokenProvider(secret, "integration-service");
    }

    public SalesInvoice invoice(UUID invoiceId) {
        return sales.get().uri("/internal/invoices/{id}", invoiceId)
                .header("Authorization", "Bearer " + tokens.token()).retrieve().body(SalesInvoice.class);
    }
}
