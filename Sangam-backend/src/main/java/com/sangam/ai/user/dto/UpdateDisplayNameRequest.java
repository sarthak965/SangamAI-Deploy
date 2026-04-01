package com.sangam.ai.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateDisplayNameRequest(
        @NotBlank(message = "Full name is required")
        @Size(max = 100, message = "Full name must be 100 characters or fewer")
        String displayName
) {
}
