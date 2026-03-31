package com.sangam.ai.workspace;

import com.sangam.ai.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRepository extends JpaRepository<Project, UUID> {
    List<Project> findByOwnerOrderByUpdatedAtDesc(User owner);
    Optional<Project> findByIdAndOwner(UUID id, User owner);
}
