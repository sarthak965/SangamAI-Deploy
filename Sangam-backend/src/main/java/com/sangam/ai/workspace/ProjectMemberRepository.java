package com.sangam.ai.workspace;

import com.sangam.ai.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, UUID> {
    List<ProjectMember> findByProjectOrderByCreatedAtAsc(Project project);
    List<ProjectMember> findByUserOrderByCreatedAtDesc(User user);
    Optional<ProjectMember> findByProjectAndUser(Project project, User user);
    boolean existsByProjectAndUser(Project project, User user);
}
