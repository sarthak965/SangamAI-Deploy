-- V2__create_environments.sql
-- ============================================================
-- Creates the environments table.
--
-- An environment is SangamAI's equivalent of a Slack workspace.
-- One user creates it (the host) and invites others to join.
-- All AI sessions happen within the context of an environment.
-- ============================================================

CREATE TABLE environments (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The human-readable name for this environment.
    -- e.g. "Study Group", "Team Alpha", "Research Room"
    name VARCHAR(100) NOT NULL,

    -- Optional longer description of what this environment is for.
    description TEXT,

    -- The user who created this environment is the host.
    -- They have full control — they can add/remove members
    -- and grant or revoke AI permissions.
    --
    -- REFERENCES users(id) is a FOREIGN KEY constraint.
    -- This means: the value in host_id MUST exist as an id
    -- in the users table. PostgreSQL enforces this at the
    -- database level — you literally cannot insert an environment
    -- with a host_id that doesn't point to a real user.
    --
    -- ON DELETE RESTRICT means: if someone tries to delete a user
    -- who is a host of an environment, PostgreSQL will BLOCK that
    -- deletion. You must handle the environment first. This prevents
    -- orphaned environments with no host.
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- A short unique code members can use to find and join
    -- this environment. Like a Slack workspace URL slug.
    -- e.g. "study-grp-2024"
    invite_code VARCHAR(20) NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- We'll frequently query "give me all environments where host_id = X"
-- (to show a user the environments they own), so index this column.
CREATE INDEX idx_environments_host_id ON environments(host_id);
CREATE INDEX idx_environments_invite_code ON environments(invite_code);