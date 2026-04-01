package com.sangam.ai.workspace.dto;

import com.sangam.ai.workspace.ProjectMemoryEntry;

import java.time.Instant;
import java.util.UUID;

public record ProjectMemoryEntryResponse(
        UUID id,
        String content,
        Instant createdAt
) {
    public static ProjectMemoryEntryResponse from(ProjectMemoryEntry entry) {
        return new ProjectMemoryEntryResponse(
                entry.getId(),
                entry.getContent(),
                entry.getCreatedAt()
        );
    }
}
