package com.sangam.ai.workspace.dto;

import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateSoloChatRequest(
        @Size(max = 255) String title,
        UUID projectId
) {
}
