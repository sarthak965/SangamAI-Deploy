package com.sangam.ai.user.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateAppearancePreferenceRequest(
        @NotBlank(message = "Appearance preference is required")
        String appearancePreference
) {
}
