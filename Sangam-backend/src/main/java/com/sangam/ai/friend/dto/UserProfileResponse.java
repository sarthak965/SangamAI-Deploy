package com.sangam.ai.friend.dto;

import com.sangam.ai.user.User;

import java.time.Instant;
import java.util.UUID;

public record UserProfileResponse(
        UUID id,
        String username,
        String displayName,
        boolean hasAvatar,
        Instant updatedAt,
        String friendshipStatus
) {
    public static UserProfileResponse from(User user, String friendshipStatus) {
        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarPath() != null && !user.getAvatarPath().isBlank(),
                user.getUpdatedAt(),
                friendshipStatus
        );
    }
}
