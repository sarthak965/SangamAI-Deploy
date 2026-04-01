package com.sangam.ai.environment;

import com.sangam.ai.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EnvironmentRepository extends JpaRepository<Environment, UUID> {
    Optional<Environment> findByInviteCode(String inviteCode);
    boolean existsByInviteCode(String inviteCode);
    List<Environment> findByHost(User host);
    List<Environment> findByIdInAndHiddenFalse(List<UUID> ids);
}
