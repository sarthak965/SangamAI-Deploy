ALTER TABLE users
    ADD COLUMN avatar_path VARCHAR(1024),
    ADD COLUMN appearance_preference VARCHAR(20) NOT NULL DEFAULT 'SYSTEM'
        CHECK (appearance_preference IN ('LIGHT', 'DARK', 'SYSTEM'));

ALTER TABLE sessions
    ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE sessions
    DROP CONSTRAINT IF EXISTS sessions_created_by_fkey;

ALTER TABLE sessions
    ADD CONSTRAINT sessions_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
