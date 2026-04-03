package com.sangam.ai.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PasswordResetConfirmRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Must be a valid email address")
        String email,
        @NotBlank(message = "OTP is required")
        @Pattern(regexp = "\\d{6}", message = "OTP must be a 6-digit code")
        String otp,
        @NotBlank(message = "New password is required")
        @Size(min = 8, max = 128, message = "New password must be 8 to 128 characters")
        String newPassword
) {
}
