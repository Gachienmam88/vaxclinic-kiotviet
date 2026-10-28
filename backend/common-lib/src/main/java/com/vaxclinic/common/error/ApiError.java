package com.vaxclinic.common.error;

import java.time.Instant;
import java.util.List;

/**
 * Standard error body returned by every service.
 * code: machine-readable (e.g. USER_NOT_FOUND), message: human-readable (Vietnamese for UI).
 */
public record ApiError(String code, String message, List<FieldViolation> details, Instant timestamp) {

    public record FieldViolation(String field, String message) {
    }

    public static ApiError of(String code, String message) {
        return new ApiError(code, message, List.of(), Instant.now());
    }
}
