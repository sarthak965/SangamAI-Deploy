package com.sangam.ai.user.dto;

public record ProfileUpdateResponse(
        CurrentUserResponse user,
        String token
) {
}
