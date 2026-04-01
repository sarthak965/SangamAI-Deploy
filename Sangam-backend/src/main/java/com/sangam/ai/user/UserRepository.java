package com.sangam.ai.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    // Spring Data JPA reads this method name and automatically
    // generates the SQL: SELECT * FROM users WHERE username = ?
    // You write zero SQL. The method name IS the query.
    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    // Returns true if a row with this username exists.
    // Generated SQL: SELECT COUNT(*) > 0 FROM users WHERE username = ?
    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByUsernameAndIdNot(String username, UUID id);

    List<User> findTop12ByUsernameContainingIgnoreCaseOrDisplayNameContainingIgnoreCaseOrderByUsernameAsc(
            String usernameQuery,
            String displayNameQuery
    );
}
