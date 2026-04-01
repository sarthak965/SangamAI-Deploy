package com.sangam.ai.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ProjectUpsertRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 5000) String description,
        String type,
        String systemInstructions,
        String knowledgeContext,
        List<String> memberUsernames
) {
}
