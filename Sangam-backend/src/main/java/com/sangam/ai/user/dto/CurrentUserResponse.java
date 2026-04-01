package com.sangam.ai.user.dto;

import com.sangam.ai.user.User;

import java.time.Instant;
import java.util.UUID;

public record CurrentUserResponse(
        UUID id,
        String username,
        String displayName,
        String email,
        boolean hasAvatar,
        String appearancePreference,
        Instant updatedAt
) {
    public static CurrentUserResponse from(User user) {
        return new CurrentUserResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getEmail(),
                user.getAvatarPath() != null && !user.getAvatarPath().isBlank(),
                user.getAppearancePreference().name(),
                user.getUpdatedAt()
        );
    }
}
