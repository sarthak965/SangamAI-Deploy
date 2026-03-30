package com.sangam.ai.environment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateMemberRoleRequest(
        @NotBlank(message = "Username is required")
        String username,

        @NotNull(message = "Role is required")
        Role role
) {
    public enum Role {
        CO_HOST,
        MEMBER
    }
}
