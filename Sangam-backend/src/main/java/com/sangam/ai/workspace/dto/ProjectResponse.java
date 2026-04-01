package com.sangam.ai.workspace.dto;

import com.sangam.ai.workspace.Project;
import com.sangam.ai.workspace.ProjectMember;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ProjectResponse(
        UUID id,
        String name,
        String description,
        String type,
        String systemInstructions,
        String knowledgeContext,
        UUID environmentId,
        List<ProjectMemberResponse> members,
        Instant createdAt,
        Instant updatedAt
) {
    public static ProjectResponse from(Project project, List<ProjectMember> members) {
        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getDescription(),
                project.getType().name(),
                project.getSystemInstructions(),
                project.getKnowledgeContext(),
                project.getEnvironment() != null ? project.getEnvironment().getId() : null,
                members.stream().map(ProjectMemberResponse::from).toList(),
                project.getCreatedAt(),
                project.getUpdatedAt()
        );
    }
}
