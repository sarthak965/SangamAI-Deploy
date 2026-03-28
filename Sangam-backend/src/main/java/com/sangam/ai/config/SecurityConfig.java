package com.sangam.ai.config;

import com.sangam.ai.auth.JwtAuthFilter;
import com.sangam.ai.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserRepository userRepository;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Disable CSRF — we don't use browser cookies for auth.
                // Our JWTs are sent in headers, which are immune to CSRF attacks.
                .csrf(AbstractHttpConfigurer::disable)

                // Stateless session — Spring Security won't create or use
                // HTTP sessions. Every request is authenticated independently
                // via its JWT. This is essential for horizontal scaling because
                // a stateful session would tie a user to one specific server instance.
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // Define which endpoints are public and which require auth.
                .authorizeHttpRequests(auth -> auth
                        // Anyone can hit the auth endpoints — obviously, since
                        // you need to register/login before you have a token.
                        .requestMatchers("/api/auth/**").permitAll()
                        // Every other endpoint requires a valid JWT.
                        .anyRequest().authenticated()
                )

                // Register our JWT filter to run BEFORE Spring Security's
                // default username/password authentication filter.
                // This is what makes JWT auth work — our filter populates
                // the SecurityContext before the rest of the chain runs.
                .addFilterBefore(jwtAuthFilter,
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // This bean tells Spring Security how to load a user by username.
    // It's used internally during authentication.
    @Bean
    public UserDetailsService userDetailsService() {
        return username -> userRepository.findByUsername(username)
                .orElseThrow(() ->
                        new UsernameNotFoundException("User not found: " + username));
    }

    // BCrypt is the industry-standard password hashing algorithm.
    // The default strength (10 rounds) is a good balance between
    // security and performance. Higher = more secure but slower.
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}