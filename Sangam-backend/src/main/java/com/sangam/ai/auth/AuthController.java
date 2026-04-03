package com.sangam.ai.auth;

import com.sangam.ai.auth.dto.AuthResponse;
import com.sangam.ai.auth.dto.GoogleLoginRequest;
import com.sangam.ai.auth.dto.LoginRequest;
import com.sangam.ai.auth.dto.PasswordResetConfirmRequest;
import com.sangam.ai.auth.dto.PasswordResetRequest;
import com.sangam.ai.auth.dto.PasswordResetResponse;
import com.sangam.ai.auth.dto.RegisterRequest;
import com.sangam.ai.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    /**
     * POST /api/auth/register
     * Body: { "username": "alex", "email": "a@b.com",
     *         "password": "secret123", "displayName": "Alex" }
     *
     * @Valid triggers the validation annotations on RegisterRequest.
     * If any field fails validation (blank username, invalid email, etc.),
     * Spring automatically returns a 400 Bad Request with error details
     * before this method even runs.
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(authService.register(request)));
    }

    /**
     * POST /api/auth/login
     * Body: { "email": "a@b.com", "password": "secret123" }
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.login(request)));
    }

    @PostMapping("/google")
    public ResponseEntity<ApiResponse<AuthResponse>> googleLogin(
            @Valid @RequestBody GoogleLoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.googleLogin(request)));
    }

    @PostMapping("/password-reset/request")
    public ResponseEntity<ApiResponse<PasswordResetResponse>> requestPasswordReset(
            @Valid @RequestBody PasswordResetRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(passwordResetService.requestReset(request)));
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<ApiResponse<PasswordResetResponse>> confirmPasswordReset(
            @Valid @RequestBody PasswordResetConfirmRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(passwordResetService.confirmReset(request)));
    }

    @GetMapping("/google/config")
    public ResponseEntity<ApiResponse<Map<String, Object>>> googleConfig() {
        String clientId = authService.getGoogleClientId();
        boolean enabled = clientId != null && !clientId.isBlank();
        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "enabled", enabled,
                "clientId", enabled ? clientId : ""
        )));
    }
}
