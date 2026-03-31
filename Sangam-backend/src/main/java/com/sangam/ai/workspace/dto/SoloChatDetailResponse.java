package com.sangam.ai.workspace.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SoloChatDetailResponse(
        UUID id,
        String title,
        boolean pinned,
        ProjectResponse project,
        Instant createdAt,
        Instant updatedAt,
        List<SoloChatMessageResponse> messages
) {
}
