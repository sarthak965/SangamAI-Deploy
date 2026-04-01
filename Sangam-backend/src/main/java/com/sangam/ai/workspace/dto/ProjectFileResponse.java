package com.sangam.ai.workspace.dto;

import com.sangam.ai.workspace.ProjectFile;

import java.time.Instant;
import java.util.UUID;

public record ProjectFileResponse(
        UUID id,
        String name,
        String contentType,
        long sizeBytes,
        boolean indexedForPrompt,
        Instant createdAt
) {
    public static ProjectFileResponse from(ProjectFile file) {
        return new ProjectFileResponse(
                file.getId(),
                file.getOriginalName(),
                file.getContentType(),
                file.getSizeBytes(),
                file.getExtractedText() != null && !file.getExtractedText().isBlank(),
                file.getCreatedAt()
        );
    }
}
