package com.sangam.ai.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProjectUpsertRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 5000) String description,
        String systemInstructions,
        String knowledgeContext
) {
}
