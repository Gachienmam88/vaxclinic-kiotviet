package com.vaxclinic.common.error;

import org.springframework.http.HttpStatus;

/** Request conflicts with current state, e.g. duplicate or concurrent change (HTTP 409). Handled by GlobalExceptionHandler like any BusinessException. */
public class ConflictException extends BusinessException {

    public ConflictException(String code, String message) {
        super(HttpStatus.CONFLICT, code, message);
    }
}
