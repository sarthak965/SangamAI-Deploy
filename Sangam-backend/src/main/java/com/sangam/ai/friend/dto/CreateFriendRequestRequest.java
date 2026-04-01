package com.sangam.ai.friend.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateFriendRequestRequest(
        @NotBlank(message = "Username is required")
        String username
) {
}
