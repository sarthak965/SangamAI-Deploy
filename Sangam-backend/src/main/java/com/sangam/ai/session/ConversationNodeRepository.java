package com.sangam.ai.session;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ConversationNodeRepository extends JpaRepository<ConversationNode, UUID> {
    List<ConversationNode> findBySessionIdOrderByCreatedAtAsc(UUID sessionId);
    List<ConversationNode> findByParentIdOrderByCreatedAtAsc(UUID parentId);

    List<ConversationNode> findBySessionIdAndDepthOrderByCreatedAtAsc(UUID sessionId, int depth);
}