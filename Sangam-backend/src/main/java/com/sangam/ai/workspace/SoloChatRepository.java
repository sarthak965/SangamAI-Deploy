package com.sangam.ai.workspace;

import com.sangam.ai.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SoloChatRepository extends JpaRepository<SoloChat, UUID> {
    List<SoloChat> findByOwnerOrderByPinnedDescUpdatedAtDesc(User owner);
    Optional<SoloChat> findByIdAndOwner(UUID id, User owner);
}
