package com.vaxclinic.common.error;

import org.springframework.http.HttpStatus;

/** Request violates a business rule or input constraint (HTTP 400). Handled by GlobalExceptionHandler like any BusinessException. */
public class ValidationException extends BusinessException {

    public ValidationException(String code, String message) {
        super(HttpStatus.BAD_REQUEST, code, message);
    }
}
