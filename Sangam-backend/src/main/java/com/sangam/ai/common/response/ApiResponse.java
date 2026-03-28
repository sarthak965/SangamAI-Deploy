package com.sangam.ai.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * A standard wrapper for every API response.
 *
 * Instead of every endpoint returning a different shape,
 * every response — success or error — follows this structure:
 *
 * Success: { "success": true,  "data": { ... } }
 * Error:   { "success": false, "message": "Username already taken" }
 *
 * @JsonInclude(NON_NULL) means fields that are null won't appear
 * in the JSON at all. So a success response won't have a "message"
 * field, and an error response won't have a "data" field.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(
        boolean success,
        T data,
        String message
) {
    // Static factory methods — clean way to create responses
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, null, message);
    }
}