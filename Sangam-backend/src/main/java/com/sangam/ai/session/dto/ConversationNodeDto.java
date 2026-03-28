package com.sangam.ai.session.dto;

import com.sangam.ai.session.ConversationNode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ConversationNodeDto(
        UUID id,
        UUID parentId,
        UUID paragraphId,
        int depth,
        String question,
        String askedByUsername,
        String fullContent,
        String status,
        Instant createdAt,
        // The paragraphs of THIS node's response
        List<ParagraphDto> paragraphs,
        // The child nodes spawned from this node's paragraphs
        List<ConversationNodeDto> children
) {
    public static ConversationNodeDto from(
            ConversationNode node,
            List<ParagraphDto> paragraphs,
            List<ConversationNodeDto> children) {

        return new ConversationNodeDto(
                node.getId(),
                node.getParent() != null ? node.getParent().getId() : null,
                node.getParagraphId(),
                node.getDepth(),
                node.getQuestion(),
                node.getAskedBy() != null ? node.getAskedBy().getUsername() : null,
                node.getFullContent(),
                node.getStatus().name(),
                node.getCreatedAt(),
                paragraphs,
                children
        );
    }
}