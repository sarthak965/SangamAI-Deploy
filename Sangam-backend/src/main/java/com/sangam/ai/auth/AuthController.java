package com.sangam.ai.auth;

import com.sangam.ai.auth.dto.AuthResponse;
import com.sangam.ai.auth.dto.LoginRequest;
import com.sangam.ai.auth.dto.RegisterRequest;
import com.sangam.ai.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

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
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(authService.register(request)));
    }

    /**
     * POST /api/auth/login
     * Body: { "email": "a@b.com", "password": "secret123" }
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.ok(authService.login(request)));
    }
}