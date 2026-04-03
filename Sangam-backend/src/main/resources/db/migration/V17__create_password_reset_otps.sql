CREATE TABLE password_reset_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_snapshot VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(100) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    send_count INT NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consumed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_otps_user_id ON password_reset_otps(user_id);
CREATE INDEX idx_password_reset_otps_email_snapshot ON password_reset_otps(email_snapshot);
CREATE INDEX idx_password_reset_otps_active
    ON password_reset_otps(email_snapshot, expires_at)
    WHERE consumed_at IS NULL;
