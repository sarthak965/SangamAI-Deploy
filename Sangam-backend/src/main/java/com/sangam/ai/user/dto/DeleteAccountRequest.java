package com.sangam.ai.user.dto;

import jakarta.validation.constraints.NotBlank;

public record DeleteAccountRequest(
        @NotBlank(message = "Confirmation text is required")
        String confirmationText
) {
}
