package com.sangam.ai.auth;

import com.sangam.ai.auth.dto.AuthResponse;
import com.sangam.ai.auth.dto.GoogleLoginRequest;
import com.sangam.ai.auth.dto.LoginRequest;
import com.sangam.ai.auth.dto.RegisterRequest;
import com.sangam.ai.user.User;
import com.sangam.ai.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor  // Lombok generates a constructor for all final fields.
// This is how Spring injects dependencies (constructor injection).
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final WebClient.Builder webClientBuilder;

    @Value("${app.google.client-id:}")
    private String googleClientId;

    public String getGoogleClientId() {
        return googleClientId;
    }

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

    public AuthResponse googleLogin(GoogleLoginRequest request) {
        if (googleClientId == null || googleClientId.isBlank()) {
            throw new IllegalStateException("Google sign-in is not configured");
        }

        Map<String, Object> tokenInfo = webClientBuilder.build()
                .get()
                .uri(uriBuilder -> uriBuilder
                        .scheme("https")
                        .host("oauth2.googleapis.com")
                        .path("/tokeninfo")
                        .queryParam("id_token", request.credential())
                        .build())
                .retrieve()
                .bodyToMono(new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {})
                .block();

        if (tokenInfo == null) {
            throw new BadCredentialsException("Invalid Google credential");
        }

        String audience = asString(tokenInfo.get("aud"));
        String email = asString(tokenInfo.get("email"));
        String emailVerified = asString(tokenInfo.get("email_verified"));
        String issuer = asString(tokenInfo.get("iss"));
        String name = asString(tokenInfo.get("name"));

        if (!googleClientId.equals(audience)) {
            throw new BadCredentialsException("Invalid Google audience");
        }
        if (!"true".equalsIgnoreCase(emailVerified)) {
            throw new BadCredentialsException("Google email is not verified");
        }
        if (!"accounts.google.com".equals(issuer) && !"https://accounts.google.com".equals(issuer)) {
            throw new BadCredentialsException("Invalid Google issuer");
        }
        if (email == null || email.isBlank()) {
            throw new BadCredentialsException("Google account email is missing");
        }

        User user = userRepository.findByEmail(email)
                .orElseGet(() -> registerGoogleUser(email, name));

        String token = jwtService.generateToken(user);
        return new AuthResponse(token, user.getUsername(), user.getDisplayName(), user.getId());
    }

    private User registerGoogleUser(String email, String name) {
        String displayName = name == null || name.isBlank()
                ? email.substring(0, email.indexOf('@'))
                : name.trim();

        User user = User.builder()
                .email(email.trim().toLowerCase(Locale.ROOT))
                .displayName(displayName)
                .username(generateUniqueUsername(displayName, email))
                .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                .build();

        return userRepository.save(user);
    }

    private String generateUniqueUsername(String displayName, String email) {
        String preferred = sanitizeUsername(displayName);
        if (preferred.isBlank()) {
            preferred = sanitizeUsername(email.substring(0, email.indexOf('@')));
        }
        if (preferred.isBlank()) {
            preferred = "user";
        }

        String candidate = preferred;
        int suffix = 1;
        while (userRepository.existsByUsername(candidate)) {
            candidate = preferred + suffix;
            suffix++;
        }
        return candidate;
    }

    private String sanitizeUsername(String value) {
        String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFKD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9._]+", "")
                .replaceAll("^[._]+|[._]+$", "");

        if (normalized.length() > 50) {
            return normalized.substring(0, 50);
        }
        return normalized;
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
