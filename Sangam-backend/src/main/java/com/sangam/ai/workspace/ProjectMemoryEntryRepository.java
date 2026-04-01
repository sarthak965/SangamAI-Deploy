package com.sangam.ai.workspace;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProjectMemoryEntryRepository extends JpaRepository<ProjectMemoryEntry, UUID> {
    List<ProjectMemoryEntry> findByProjectOrderByCreatedAtDesc(Project project);
}
