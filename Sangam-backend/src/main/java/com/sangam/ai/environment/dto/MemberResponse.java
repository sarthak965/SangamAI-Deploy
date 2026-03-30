package com.sangam.ai.environment.dto;

import com.sangam.ai.environment.EnvironmentMember;
import java.util.UUID;

public record MemberResponse(
        UUID userId,
        String username,
        String displayName,
        String role,
        boolean owner,
        boolean canInteractWithAi
) {
    public static MemberResponse from(EnvironmentMember member, boolean isOwner) {
        return new MemberResponse(
                member.getUser().getId(),
                member.getUser().getUsername(),
                member.getUser().getDisplayName(),
                isOwner ? "OWNER" : member.getRole().name(),
                isOwner,
                member.isCanInteractWithAi()
        );
    }
}
