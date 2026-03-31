package com.sangam.ai.workspace.dto;

import jakarta.validation.constraints.NotBlank;

public record SendSoloMessageRequest(
        @NotBlank String content
) {
}
