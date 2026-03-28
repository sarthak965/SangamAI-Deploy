package com.sangam.ai.auth.dto;

import java.util.UUID;

// What we send BACK to the client after successful login or register.
// The client stores this token and sends it with every future request
// in the Authorization header: "Bearer <token>"
public record AuthResponse(
        String token,
        String username,
        String displayName,
        UUID userId
) {}