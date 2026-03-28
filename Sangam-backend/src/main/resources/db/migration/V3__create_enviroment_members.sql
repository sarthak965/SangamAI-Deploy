-- V3__create_environment_members.sql
-- ============================================================
-- Creates the environment_members join table.
--
-- This table is the bridge between users and environments.
-- It answers the question: "which users belong to which
-- environments, and what are their permissions?"
--
-- In database design, when two entities have a many-to-many
-- relationship (one user can be in many environments, one
-- environment can have many users), you resolve it with a
-- "join table" like this one.
-- ============================================================

CREATE TABLE environment_members (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Which environment this membership belongs to.
    -- ON DELETE CASCADE means: if the environment is deleted,
    -- all its membership records are automatically deleted too.
    -- This makes sense — members of a deleted room shouldn't
    -- linger as orphaned records.
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,

    -- Which user this membership belongs to.
    -- ON DELETE CASCADE: if a user deletes their account,
    -- their membership records are cleaned up automatically.
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- The role of this member within the environment.
    -- 'HOST'   = the creator, full control
    -- 'MEMBER' = a regular participant
    --
    -- You might wonder: why store the host role here when we
    -- already have host_id in the environments table?
    -- Because having role in this table means a single query
    -- can tell you both "is this user in this environment?"
    -- AND "what is their role?" without joining to environments.
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER'
        CHECK (role IN ('HOST', 'MEMBER')),

    -- This is the core permission flag for SangamAI.
    -- The host can toggle this per member:
    --   true  = this member can send questions to the AI
    --   false = this member can only observe the AI conversation
    --
    -- This defaults to false — members are observers until
    -- the host explicitly grants them AI access. This is the
    -- safer default: better to grant access than accidentally
    -- expose it to everyone.
    can_interact_with_ai BOOLEAN NOT NULL DEFAULT FALSE,

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- This constraint ensures a user can only be a member of
    -- any given environment ONCE. Without this, you could
    -- accidentally insert the same user into the same environment
    -- twice and create duplicate membership records.
    -- UNIQUE on a combination of columns = a "composite unique constraint".
    CONSTRAINT uq_environment_member UNIQUE (environment_id, user_id)
);

-- We'll frequently query "give me all members of environment X"
-- and "give me all environments user Y is a member of".
-- Both of these access patterns need an index.
CREATE INDEX idx_env_members_environment_id ON environment_members(environment_id);
CREATE INDEX idx_env_members_user_id ON environment_members(user_id);