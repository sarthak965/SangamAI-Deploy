CREATE TABLE solo_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL
        REFERENCES solo_chats(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('USER', 'ASSISTANT', 'SYSTEM')),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETE'
        CHECK (status IN ('STREAMING', 'COMPLETE')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_solo_chat_messages_chat_id ON solo_chat_messages(chat_id);
CREATE INDEX idx_solo_chat_messages_chat_created_at
    ON solo_chat_messages(chat_id, created_at ASC);
