package com.sangam.ai.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.function.Function;

@Service
public class JwtService {

    // Spring reads these values from application.properties automatically.
    // The @Value annotation injects the value of the named property.
    @Value("${app.jwt.secret}")
    private String secretKey;

    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;

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
        return Jwts.builder()
                .subject(userDetails.getUsername())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    // Extracts the username from a token's subject claim
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    // Checks that the token belongs to this user AND hasn't expired
    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
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