package com.sangam.ai.workspace;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SoloChatMessageRepository extends JpaRepository<SoloChatMessage, UUID> {
    List<SoloChatMessage> findByChatIdOrderByCreatedAtAsc(UUID chatId);
    Optional<SoloChatMessage> findTopByChatIdOrderByCreatedAtDesc(UUID chatId);
}
