package com.sangam.ai.friend.dto;

import com.sangam.ai.user.User;

import java.time.Instant;
import java.util.UUID;

public record FriendUserResponse(
        UUID id,
        String username,
        String displayName,
        boolean hasAvatar,
        Instant updatedAt
) {
    public static FriendUserResponse from(User user) {
        return new FriendUserResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarPath() != null && !user.getAvatarPath().isBlank(),
                user.getUpdatedAt()
        );
    }
}
