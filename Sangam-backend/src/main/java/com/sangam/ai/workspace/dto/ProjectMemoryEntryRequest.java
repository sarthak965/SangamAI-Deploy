package com.sangam.ai.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProjectMemoryEntryRequest(
        @NotBlank
        @Size(max = 4000)
        String content
) {
}
