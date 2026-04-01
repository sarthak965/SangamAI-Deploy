package com.sangam.ai.workspace.dto;

import com.sangam.ai.workspace.ProjectMember;

import java.time.Instant;
import java.util.UUID;

public record ProjectMemberResponse(
        UUID userId,
        String username,
        String displayName,
        boolean hasAvatar,
        Instant updatedAt,
        String role
) {
    public static ProjectMemberResponse from(ProjectMember member) {
        return new ProjectMemberResponse(
                member.getUser().getId(),
                member.getUser().getUsername(),
                member.getUser().getDisplayName(),
                member.getUser().getAvatarPath() != null && !member.getUser().getAvatarPath().isBlank(),
                member.getUser().getUpdatedAt(),
                member.getRole().name()
        );
    }
}
