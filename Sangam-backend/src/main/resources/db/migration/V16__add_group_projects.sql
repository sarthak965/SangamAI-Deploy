ALTER TABLE environments
    ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE projects
    ADD COLUMN project_type VARCHAR(20) NOT NULL DEFAULT 'PERSONAL'
        CHECK (project_type IN ('PERSONAL', 'GROUP')),
    ADD COLUMN environment_id UUID REFERENCES environments(id) ON DELETE SET NULL;

CREATE INDEX idx_projects_environment_id ON projects(environment_id);

CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('OWNER', 'MEMBER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

INSERT INTO project_members (project_id, user_id, role, created_at)
SELECT id, owner_id, 'OWNER', created_at
FROM projects;
