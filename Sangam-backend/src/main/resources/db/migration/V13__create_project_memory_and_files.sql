CREATE TABLE project_memory_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL
        REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_memory_entries_project_id
    ON project_memory_entries(project_id);

CREATE INDEX idx_project_memory_entries_project_created_at
    ON project_memory_entries(project_id, created_at DESC);

CREATE TABLE project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL
        REFERENCES projects(id) ON DELETE CASCADE,
    original_name VARCHAR(512) NOT NULL,
    stored_name VARCHAR(512) NOT NULL,
    storage_path VARCHAR(1024) NOT NULL,
    content_type VARCHAR(255),
    size_bytes BIGINT NOT NULL,
    extracted_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_files_project_id
    ON project_files(project_id);

CREATE INDEX idx_project_files_project_created_at
    ON project_files(project_id, created_at DESC);
