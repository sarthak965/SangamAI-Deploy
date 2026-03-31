CREATE TABLE solo_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID
        REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_solo_chats_owner_id ON solo_chats(owner_id);
CREATE INDEX idx_solo_chats_project_id ON solo_chats(project_id);
CREATE INDEX idx_solo_chats_owner_updated_at ON solo_chats(owner_id, updated_at DESC);
