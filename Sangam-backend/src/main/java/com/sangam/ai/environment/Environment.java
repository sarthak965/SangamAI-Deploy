package com.sangam.ai.environment;

import com.sangam.ai.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "environments")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Environment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    /**
     * @ManyToOne means many environments can have the same host.
     * @JoinColumn tells JPA that the foreign key column in the
     * environments table is named "host_id".
     * fetch = LAZY means JPA won't load the full User object from
     * the DB unless you explicitly access it. This is important for
     * performance — you don't want to load the host's data every
     * single time you load an environment.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;

    @Column(nullable = false, unique = true, length = 20)
    private String inviteCode;

    @Builder.Default
    @Column(nullable = false)
    private boolean hidden = false;

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
}
