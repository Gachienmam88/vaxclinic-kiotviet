package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/** Mã hàng / tên hàng / ĐVT dài hơn cột invoice_lines phải bị chặn 400 ở bước validate (trước khi trừ kho). */
class InvoiceLineInputValidationTest {

    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    private static LineInput line(String code, String name, String unit) {
        return new LineInput(UUID.randomUUID(), UUID.randomUUID(), code, name, unit, BigDecimal.ONE, BigDecimal.TEN,
                null, null, null);
    }

    private static Set<String> messages(LineInput in) {
        return VALIDATOR.validate(in).stream().map(ConstraintViolation::getMessage).collect(Collectors.toSet());
    }

    @Test
    void maxLengthsMatchDbColumnsAreAccepted() {
        assertThat(messages(line("C".repeat(50), "N".repeat(250), "U".repeat(50)))).isEmpty();
    }

    @Test
    void overLongValuesAreRejectedWithVietnameseMessages() {
        assertThat(messages(line("C".repeat(51), "N".repeat(251), "U".repeat(51)))).containsExactlyInAnyOrder(
                "Mã hàng tối đa 50 ký tự", "Tên hàng tối đa 250 ký tự", "Đơn vị tính tối đa 50 ký tự");
    }
}
