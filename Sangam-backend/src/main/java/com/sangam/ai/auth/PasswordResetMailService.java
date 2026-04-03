package com.sangam.ai.auth;

import jakarta.mail.internet.InternetAddress;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PasswordResetMailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${app.mail.from-email:}")
    private String fromEmail;

    @Value("${app.mail.from-name:SangamAI}")
    private String fromName;

    public boolean isConfigured() {
        return hasText(mailHost)
                && hasText(fromEmail)
                && mailSenderProvider.getIfAvailable() != null;
    }

    public void sendPasswordResetOtp(String recipientEmail, String otp, long expiryMinutes) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null || !isConfigured()) {
            throw new PasswordResetUnavailableException("Password reset is not available right now");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(recipientEmail);
        message.setFrom(buildFromHeader());
        message.setSubject("Your SangamAI password reset code");
        message.setText("""
                We received a request to reset your SangamAI password.

                Your one-time code is: %s

                This code expires in %d minutes.
                If you did not request this change, you can ignore this email.
                """.formatted(otp, expiryMinutes));

        mailSender.send(message);
    }

    private String buildFromHeader() {
        if (!hasText(fromName)) {
            return fromEmail;
        }
        try {
            return new InternetAddress(fromEmail, fromName).toString();
        } catch (Exception ignored) {
            return fromEmail;
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
