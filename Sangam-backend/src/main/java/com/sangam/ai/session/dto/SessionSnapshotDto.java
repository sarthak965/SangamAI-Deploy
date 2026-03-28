package com.sangam.ai.session.dto;

import java.util.List;
import java.util.UUID;

// The complete state of a session sent to a new member joining.
// Contains the full tree — all nodes, all paragraphs, all children.
public record SessionSnapshotDto(
        UUID sessionId,
        String title,
        String status,
        // The root nodes of this session (depth=0)
        // Each carries its children recursively
        List<ConversationNodeDto> rootNodes
) {}