package com.sangam.ai.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Allows the frontend (running on a different port) to call
 * the backend API without being blocked by browser CORS policy.
 *
 * In production, replace "*" with your actual frontend domain.
 */
@Configuration
public class CorsConfig {

    @Value("${app.cors.allowed-origin-patterns:http://localhost:5173,http://127.0.0.1:5173,https://*.vercel.app}")
    private String allowedOriginPatterns;

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOriginPatterns(Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toList()));

        // Allow all standard HTTP methods
        config.setAllowedMethods(List.of(
                "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));

        // Allow these headers in requests
        config.setAllowedHeaders(List.of(
                "Authorization", "Content-Type", "Accept"));

        // Allow the browser to read these headers from responses
        config.setExposedHeaders(List.of("Authorization"));

        // Allow cookies and auth headers
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);

        return new CorsFilter(source);
    }
}
