package com.sangam.ai.session;

import com.sangam.ai.environment.Environment;
import com.sangam.ai.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sessions")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class Session {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "environment_id", nullable = false)
    private Environment environment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    private String title;

    @Builder.Default
    @Convert(converter = SessionStatusConverter.class)
    @Column(nullable = false)
    private Status status = Status.OPEN;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate protected void onUpdate() {
        updatedAt = Instant.now();
    }

    public enum Status { OPEN, CLOSED }
}
