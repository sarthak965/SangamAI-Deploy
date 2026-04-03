package com.sangam.ai.auth;

public class PasswordResetUnavailableException extends RuntimeException {

    public PasswordResetUnavailableException(String message) {
        super(message);
    }
}
