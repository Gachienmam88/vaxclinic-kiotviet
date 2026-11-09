package com.vaxclinic.common.error;

import org.springframework.http.HttpStatus;

/** Requested resource does not exist (HTTP 404). Handled by GlobalExceptionHandler like any BusinessException. */
public class ResourceNotFoundException extends BusinessException {

    public ResourceNotFoundException(String code, String message) {
        super(HttpStatus.NOT_FOUND, code, message);
    }
}
