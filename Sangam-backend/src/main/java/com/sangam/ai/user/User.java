package com.sangam.ai.user;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    // Named passwordHash — never plain text. Ever.
    @Column(nullable = false, length = 60)
    private String passwordHash;

    @Column(nullable = false, length = 100)
    private String displayName;

    @Column(name = "avatar_path", length = 1024)
    private String avatarPath;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "appearance_preference", nullable = false, length = 20)
    private AppearancePreference appearancePreference = AppearancePreference.SYSTEM;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // --- UserDetails interface (required by Spring Security) ---

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // Permissions in SangamAI are per-environment, not global.
        // So no global roles needed here.
        return List.of();
    }

    @Override public boolean isAccountNonExpired()    { return true; }
    @Override public boolean isAccountNonLocked()     { return true; }
    @Override public boolean isCredentialsNonExpired(){ return true; }
    @Override public boolean isEnabled()              { return true; }

    public enum AppearancePreference {
        LIGHT,
        DARK,
        SYSTEM
    }
}
