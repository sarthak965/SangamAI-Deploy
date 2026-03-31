ALTER TABLE solo_chats
    ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_solo_chats_owner_pinned_updated_at
    ON solo_chats(owner_id, pinned DESC, updated_at DESC);
