package com.sangam.ai.auth;

import com.sangam.ai.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * This filter runs once for every HTTP request before it reaches your controllers.
 * Its only job is to check: "does this request carry a valid JWT token?
 * If yes, mark this request as authenticated."
 *
 * Think of it as the security guard at the door who checks ID badges.
 * If the badge is valid, they let you in. If not, they don't stop you —
 * they just don't grant you access. The SecurityConfig decides what
 * happens to unauthenticated requests for each endpoint.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        // Every authenticated request must include this header:
        // Authorization: Bearer eyJhbGci...
        final String authHeader = request.getHeader("Authorization");

        // If the header is missing or doesn't start with "Bearer ",
        // this request has no JWT. Pass it through — SecurityConfig
        // will decide if it can proceed without authentication.
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Strip the "Bearer " prefix (7 characters) to get the raw token
        final String jwt = authHeader.substring(7);

        try {
            final String username = jwtService.extractUsername(jwt);

            // Only proceed if we got a username AND the request isn't
            // already authenticated (to avoid doing this work twice).
            if (username != null &&
                    SecurityContextHolder.getContext().getAuthentication() == null) {

                var user = userRepository.findByUsername(username).orElse(null);

                if (user != null && jwtService.isTokenValid(jwt, user)) {
                    // This is how you tell Spring Security "this request
                    // is authenticated as this user". Once this is set on
                    // the SecurityContext, all downstream code (your
                    // controllers, services) can call
                    // SecurityContextHolder.getContext().getAuthentication()
                    // to find out who is making the request.
                    var authToken = new UsernamePasswordAuthenticationToken(
                            user, null, user.getAuthorities());
                    authToken.setDetails(
                            new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (Exception e) {
            // Token is malformed, expired, or has an invalid signature.
            // We don't throw — we just don't authenticate the request.
            // The filter chain continues and SecurityConfig decides
            // what to do with an unauthenticated request.
            logger.warn("JWT validation failed: " + e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}