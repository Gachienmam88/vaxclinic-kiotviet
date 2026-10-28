package com.vaxclinic.sales.invoice.checkout;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Ghi nhận lần thanh toán TRƯỚC khi trừ kho (transaction riêng, commit ngay) → job đối soát luôn thấy được lần thanh
 * toán dù bước lưu hóa đơn lỗi / service chết giữa chừng. Lưu hóa đơn thành công gọi {@link #markDone} trong CÙNG
 * transaction ghi hóa đơn.
 */
@Service
public class CheckoutAttemptService {

    private final CheckoutAttemptRepository attempts;
    private final ObjectMapper json;

    public CheckoutAttemptService(CheckoutAttemptRepository attempts, ObjectMapper json) {
        this.attempts = attempts;
        this.json = json;
    }

    /** Bắt đầu / thử lại 1 lần thanh toán. Trả chứng từ kho phải dùng cho lệnh SALE. */
    @Transactional
    public UUID begin(InvoiceRequest req, String code, String partnerName, Actor actor, BigDecimal total) {
        boolean firstTime = attempts.insertIfAbsent(req.id(), req.branchId());
        CheckoutAttempt existing = attempts.lock(req.id());
        var begin = CheckoutAttemptRules.onBegin(req.id(), firstTime ? null : existing);
        if (begin.reconciling()) {
            throw new BusinessException(HttpStatus.CONFLICT, "CHECKOUT_RECONCILING",
                    "Hóa đơn đang được đối soát kho, vui lòng thử lại sau ít phút");
        }
        String summary = code + " · " + req.lines().size() + " dòng · tổng " + Actor.money(total) + " · " + partnerName;
        attempts.start(req.id(), begin.stockDocId(), begin.round(), code, partnerName, actor.id(), hash(req), summary);
        return begin.stockDocId();
    }

    /** Kho từ chối (lỗi nghiệp vụ 4xx: thiếu tồn, hàng không tồn tại) → không trừ gì, không cần hoàn kho. */
    @Transactional
    public void markFailed(UUID id, String error) {
        attempts.setStatus(id, CheckoutAttempt.FAILED, error);
    }

    /**
     * Gọi trong transaction lưu hóa đơn. false = lần thanh toán đã / đang bị job đối soát hoàn kho (hoặc lần gửi song
     * song khác đã xong) → người gọi kiểm tra hóa đơn đã tồn tại chưa, chưa thì rollback.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean markDone(UUID id, UUID stockDocId) {
        return attempts.markDone(id, stockDocId);
    }

    private String hash(InvoiceRequest req) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(req));
            return HexFormat.of().formatHex(digest);
        } catch (JsonProcessingException | NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
