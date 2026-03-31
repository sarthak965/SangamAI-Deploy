package com.sangam.ai.workspace.dto;

import com.sangam.ai.workspace.Project;

import java.time.Instant;
import java.util.UUID;

public record ProjectResponse(
        UUID id,
        String name,
        String description,
        String systemInstructions,
        String knowledgeContext,
        Instant createdAt,
        Instant updatedAt
) {
    public static ProjectResponse from(Project project) {
        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getDescription(),
                project.getSystemInstructions(),
                project.getKnowledgeContext(),
                project.getCreatedAt(),
                project.getUpdatedAt()
        );
    }
}
