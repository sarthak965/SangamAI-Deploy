package com.sangam.ai.workspace;

import com.sangam.ai.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SoloChatRepository extends JpaRepository<SoloChat, UUID> {
    List<SoloChat> findByOwnerOrderByPinnedDescUpdatedAtDesc(User owner);
    List<SoloChat> findByOwnerAndProjectIsNullOrderByPinnedDescUpdatedAtDesc(User owner);
    Optional<SoloChat> findByIdAndOwner(UUID id, User owner);
    List<SoloChat> findByProject(Project project);
    List<SoloChat> findByProjectOrderByUpdatedAtDesc(Project project);
}
