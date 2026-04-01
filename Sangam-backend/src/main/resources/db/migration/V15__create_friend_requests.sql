CREATE TABLE friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('PENDING', 'ACCEPTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_friend_request_not_self CHECK (requester_id <> receiver_id),
    CONSTRAINT uq_friend_request_direction UNIQUE (requester_id, receiver_id)
);

CREATE INDEX idx_friend_requests_requester_status
    ON friend_requests(requester_id, status, created_at DESC);

CREATE INDEX idx_friend_requests_receiver_status
    ON friend_requests(receiver_id, status, created_at DESC);
