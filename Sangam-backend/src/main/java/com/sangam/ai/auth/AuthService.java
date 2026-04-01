package com.sangam.ai.auth;

import com.sangam.ai.auth.dto.AuthResponse;
import com.sangam.ai.auth.dto.LoginRequest;
import com.sangam.ai.auth.dto.RegisterRequest;
import com.sangam.ai.user.User;
import com.sangam.ai.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor  // Lombok generates a constructor for all final fields.
// This is how Spring injects dependencies (constructor injection).
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthResponse register(RegisterRequest request) {

        // Check for conflicts before doing any work
        if (userRepository.existsByUsername(request.username())) {
            throw new IllegalArgumentException("Username already taken");
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email already registered");
        }

        // Build the User entity using the Lombok @Builder we defined.
        // Notice we hash the password with BCrypt before saving.
        // passwordEncoder.encode() is a one-way hash — it can never
        // be reversed. We only ever compare, never decode.
        User user = User.builder()
                .username(request.username())
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .displayName(request.displayName())
                .build();

        User saved = userRepository.save(user);

        // Generate a JWT for the newly registered user so they're
        // logged in immediately without a separate login step.
        String token = jwtService.generateToken(saved);

        return new AuthResponse(token, saved.getUsername(),
                saved.getDisplayName(), saved.getId());
    }

    public AuthResponse login(LoginRequest request) {

        // Look up by email — throw a generic error if not found.
        // IMPORTANT: we use the same generic error message for both
        // "user not found" and "wrong password". This is intentional —
        // different error messages for each case would let an attacker
        // enumerate valid email addresses on your platform.
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        // BCrypt comparison: passwordEncoder.matches() takes the
        // raw input and the stored hash and returns true/false.
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid credentials");
        }

        String token = jwtService.generateToken(user);

        return new AuthResponse(token, user.getUsername(),
                user.getDisplayName(), user.getId());
    }
}
