package com.sangam.ai.workspace.dto;

import java.util.UUID;

public record UpdateSoloChatRequest(
        String title,
        UUID projectId,
        Boolean pinned
) {
}
