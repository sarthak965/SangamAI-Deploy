package com.sangam.ai.workspace.dto;

import com.sangam.ai.workspace.Project;
import com.sangam.ai.workspace.SoloChat;
import com.sangam.ai.workspace.SoloChatMessage;

import java.time.Instant;
import java.util.UUID;

public record SoloChatSummaryResponse(
        UUID id,
        String title,
        boolean pinned,
        UUID projectId,
        String projectName,
        String lastMessagePreview,
        Instant createdAt,
        Instant updatedAt
) {
    public static SoloChatSummaryResponse from(
            SoloChat chat,
            Project project,
            SoloChatMessage lastMessage
    ) {
        return new SoloChatSummaryResponse(
                chat.getId(),
                chat.getTitle(),
                chat.isPinned(),
                project != null ? project.getId() : null,
                project != null ? project.getName() : null,
                summarize(lastMessage != null ? lastMessage.getContent() : null),
                chat.getCreatedAt(),
                chat.getUpdatedAt()
        );
    }

    private static String summarize(String content) {
        if (content == null || content.isBlank()) {
            return "";
        }
        String normalized = content.trim().replaceAll("\\s+", " ");
        return normalized.length() > 140 ? normalized.substring(0, 140) + "..." : normalized;
    }
}
