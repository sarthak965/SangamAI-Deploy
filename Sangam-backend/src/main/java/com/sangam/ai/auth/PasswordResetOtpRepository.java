package com.sangam.ai.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetOtpRepository extends JpaRepository<PasswordResetOtp, UUID> {

    Optional<PasswordResetOtp> findTopByEmailSnapshotAndConsumedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(
            String emailSnapshot,
            Instant now
    );

    Optional<PasswordResetOtp> findTopByUserIdAndConsumedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(
            UUID userId,
            Instant now
    );

    List<PasswordResetOtp> findByUserIdAndConsumedAtIsNullAndExpiresAtAfter(UUID userId, Instant now);

    long countByEmailSnapshotAndCreatedAtAfter(String emailSnapshot, Instant since);
}
