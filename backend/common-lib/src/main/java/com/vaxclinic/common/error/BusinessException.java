package com.vaxclinic.common.error;

import org.springframework.http.HttpStatus;

/** Thrown by domain/service code for expected business errors; mapped to ApiError by GlobalExceptionHandler. */
public class BusinessException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public BusinessException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static BusinessException notFound(String code, String message) {
        return new ResourceNotFoundException(code, message);
    }

    public static BusinessException badRequest(String code, String message) {
        return new ValidationException(code, message);
    }

    public static BusinessException conflict(String code, String message) {
        return new ConflictException(code, message);
    }

    public static BusinessException forbidden(String code, String message) {
        return new ForbiddenException(code, message);
    }

    public static BusinessException upstream(String code, String message) {
        return new UpstreamServiceException(code, message);
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
