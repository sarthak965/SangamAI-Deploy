package com.sangam.ai.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateUsernameRequest(
        @NotBlank(message = "Username is required")
        @Size(min = 3, max = 50, message = "Username must be 3-50 characters")
        @Pattern(
                regexp = "^[A-Za-z0-9_\\.]+$",
                message = "Username can only contain letters, numbers, underscores, and periods"
        )
        String username
) {
}
