package com.vaxclinic.common.error;

import org.springframework.http.HttpStatus;

/** Caller is authenticated but not allowed to act on this resource (HTTP 403). Handled by GlobalExceptionHandler like any BusinessException. */
public class ForbiddenException extends BusinessException {

    public ForbiddenException(String code, String message) {
        super(HttpStatus.FORBIDDEN, code, message);
    }
}
