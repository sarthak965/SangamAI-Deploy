package com.sangam.ai.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import com.sangam.ai.user.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;
import java.util.function.Function;

@Service
public class JwtService {

    // Spring reads these values from application.properties automatically.
    // The @Value annotation injects the value of the named property.
    @Value("${app.jwt.secret}")
    private String secretKey;

    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;

    @PostConstruct
    void validateConfiguration() {
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalStateException("JWT secret is required. Set JWT_SECRET before starting the application.");
        }
        if (secretKey.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT secret must be at least 32 bytes long.");
        }
    }

    /**
     * Generates a JWT token for the given user.
     * The token contains:
     *   - subject: the username (who this token belongs to)
     *   - issuedAt: when it was created
     *   - expiration: when it stops being valid
     *   - signature: a cryptographic signature using our secret key
     *
     * The signature is what makes JWTs trustworthy. Anyone can READ
     * the payload (it's just Base64), but only someone with the secret
     * key can CREATE a valid signature. When we verify a token, we're
     * checking that the signature matches — if it does, we know we
     * issued this token and it hasn't been tampered with.
     */
    public String generateToken(UserDetails userDetails) {
        if (userDetails instanceof User user) {
            return generateToken(user);
        }
        return Jwts.builder()
                .subject(userDetails.getUsername())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    public String generateToken(User user) {
        return Jwts.builder()
                .subject(user.getId().toString())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    // Extracts the username from a token's subject claim
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(extractClaim(token, Claims::getSubject));
    }

    // Checks that the token belongs to this user AND hasn't expired
    public boolean isTokenValid(String token, UserDetails userDetails) {
        if (userDetails instanceof User user) {
            try {
                return user.getId().equals(extractUserId(token)) && !isTokenExpired(token);
            } catch (Exception ignored) {
                return user.getUsername().equals(extractUsername(token)) && !isTokenExpired(token);
            }
        }
        final String subject = extractUsername(token);
        return subject.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    // Generic claim extractor — takes a function that picks
    // which claim you want from the full Claims object.
    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claimsResolver.apply(claims);
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8));
    }
}
