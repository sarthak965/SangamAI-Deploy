package com.sangam.ai.workspace.dto;

import com.sangam.ai.workspace.SoloChatMessage;

import java.time.Instant;
import java.util.UUID;

public record SoloChatMessageResponse(
        UUID id,
        String role,
        String status,
        String content,
        Instant createdAt
) {
    public static SoloChatMessageResponse from(SoloChatMessage message) {
        return new SoloChatMessageResponse(
                message.getId(),
                message.getRole().name(),
                message.getStatus().name(),
                message.getContent(),
                message.getCreatedAt()
        );
    }
}
