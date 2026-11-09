package com.vaxclinic.common.error;

import org.springframework.http.HttpStatus;

/** A downstream/third-party service failed or returned an invalid response (HTTP 502). Handled by GlobalExceptionHandler like any BusinessException. */
public class UpstreamServiceException extends BusinessException {

    public UpstreamServiceException(String code, String message) {
        super(HttpStatus.BAD_GATEWAY, code, message);
    }
}
