package com.sangam.ai.workspace;

import com.sangam.ai.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRepository extends JpaRepository<Project, UUID> {
    List<Project> findByOwnerOrderByUpdatedAtDesc(User owner);
    Optional<Project> findByIdAndOwner(UUID id, User owner);

    @Query("""
            select distinct p from Project p
            left join ProjectMember pm on pm.project = p
            where p.owner = :user or pm.user = :user
            order by p.updatedAt desc
            """)
    List<Project> findVisibleProjects(User user);
}
