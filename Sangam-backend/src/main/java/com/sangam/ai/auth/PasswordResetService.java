package com.sangam.ai.auth;

import com.sangam.ai.auth.dto.PasswordResetConfirmRequest;
import com.sangam.ai.auth.dto.PasswordResetRequest;
import com.sangam.ai.auth.dto.PasswordResetResponse;
import com.sangam.ai.user.User;
import com.sangam.ai.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String REQUEST_MESSAGE =
            "If an account exists for that email, we sent a verification code.";

    private final UserRepository userRepository;
    private final PasswordResetOtpRepository passwordResetOtpRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetMailService passwordResetMailService;

    @Value("${app.auth.password-reset.otp-length:6}")
    private int otpLength;

    @Value("${app.auth.password-reset.expiry-minutes:10}")
    private long expiryMinutes;

    @Value("${app.auth.password-reset.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.auth.password-reset.resend-cooldown-seconds:60}")
    private long resendCooldownSeconds;

    @Value("${app.auth.password-reset.max-requests-per-hour:5}")
    private int maxRequestsPerHour;

    @Transactional
    public PasswordResetResponse requestReset(PasswordResetRequest request) {
        try {
            if (!passwordResetMailService.isConfigured()) {
                throw new PasswordResetUnavailableException("Password reset is not available right now");
            }

            String normalizedEmail = normalizeEmail(request.email());
            User user = userRepository.findByEmail(normalizedEmail).orElse(null);
            if (user == null) {
                return new PasswordResetResponse(REQUEST_MESSAGE);
            }

            Instant now = Instant.now();
            long recentRequestCount = passwordResetOtpRepository.countByEmailSnapshotAndCreatedAtAfter(
                    normalizedEmail,
                    now.minus(Duration.ofHours(1))
            );
            if (recentRequestCount >= maxRequestsPerHour) {
                return new PasswordResetResponse(REQUEST_MESSAGE);
            }

            passwordResetOtpRepository.findTopByUserIdAndConsumedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(
                            user.getId(), now)
                    .ifPresent(active -> {
                        Instant nextAllowed = active.getLastSentAt().plusSeconds(resendCooldownSeconds);
                        if (nextAllowed.isAfter(now)) {
                            throw new QuietPasswordResetThrottleException();
                        }
                        active.setConsumedAt(now);
                        passwordResetOtpRepository.save(active);
                    });

            String otp = generateOtp();
            passwordResetOtpRepository.save(PasswordResetOtp.builder()
                    .user(user)
                    .emailSnapshot(normalizedEmail)
                    .otpHash(passwordEncoder.encode(otp))
                    .expiresAt(now.plus(Duration.ofMinutes(expiryMinutes)))
                    .lastSentAt(now)
                    .sendCount(1)
                    .build());

            passwordResetMailService.sendPasswordResetOtp(normalizedEmail, otp, expiryMinutes);

            return new PasswordResetResponse(REQUEST_MESSAGE);
        } catch (QuietPasswordResetThrottleException ignored) {
            return new PasswordResetResponse(REQUEST_MESSAGE);
        }
    }

    @Transactional
    public PasswordResetResponse confirmReset(PasswordResetConfirmRequest request) {
        String normalizedEmail = normalizeEmail(request.email());
        Instant now = Instant.now();

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired code"));

        PasswordResetOtp activeOtp = passwordResetOtpRepository
                .findTopByEmailSnapshotAndConsumedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(
                        normalizedEmail, now)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired code"));

        if (!activeOtp.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Invalid or expired code");
        }

        if (activeOtp.getAttemptCount() >= maxAttempts || !activeOtp.getExpiresAt().isAfter(now)) {
            activeOtp.setConsumedAt(now);
            passwordResetOtpRepository.save(activeOtp);
            throw new IllegalArgumentException("Invalid or expired code");
        }

        if (!passwordEncoder.matches(request.otp(), activeOtp.getOtpHash())) {
            activeOtp.setAttemptCount(activeOtp.getAttemptCount() + 1);
            if (activeOtp.getAttemptCount() >= maxAttempts) {
                activeOtp.setConsumedAt(now);
            }
            passwordResetOtpRepository.save(activeOtp);
            throw new IllegalArgumentException("Invalid or expired code");
        }

        if (passwordEncoder.matches(request.newPassword(), user.getPassword())) {
            throw new IllegalArgumentException("New password must be different from the current password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        List<PasswordResetOtp> activeOtps =
                passwordResetOtpRepository.findByUserIdAndConsumedAtIsNullAndExpiresAtAfter(user.getId(), now);
        for (PasswordResetOtp otp : activeOtps) {
            otp.setConsumedAt(now);
        }
        passwordResetOtpRepository.saveAll(activeOtps);

        return new PasswordResetResponse("Password updated successfully. You can now sign in.");
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private String generateOtp() {
        int digits = Math.max(4, otpLength);
        int bound = (int) Math.pow(10, digits);
        int value = SECURE_RANDOM.nextInt(bound);
        return String.format("%0" + digits + "d", value);
    }

    private static final class QuietPasswordResetThrottleException extends RuntimeException {
    }
}
