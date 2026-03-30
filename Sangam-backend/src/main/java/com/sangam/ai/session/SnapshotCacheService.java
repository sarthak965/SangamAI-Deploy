package com.sangam.ai.session;

import com.sangam.ai.session.dto.SessionSnapshotDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

/**
 * Caches session snapshots in Redis.
 *
 * Rule: Redis owns speed, PostgreSQL owns truth.
 *
 * We cache the snapshot for 10 minutes. When the AI
 * finishes streaming a node, we invalidate the cache
 * so the next snapshot call rebuilds from PostgreSQL
 * with the fresh content.
 *
 * Cache key format: "snapshot:session:{sessionId}"
 * This is human-readable and easy to inspect in Redis.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SnapshotCacheService {

    private static final String KEY_PREFIX = "snapshot:session:";
    // Cache expires after 10 minutes even without explicit invalidation
    private static final Duration TTL = Duration.ofMinutes(10);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public void put(UUID sessionId, SessionSnapshotDto snapshot) {
        String key = key(sessionId);
        try {
            String payload = objectMapper.writeValueAsString(snapshot);
            redisTemplate.opsForValue().set(key, payload, TTL);
            log.debug("Cached snapshot for session {}", sessionId);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize snapshot for session {}: {}",
                    sessionId, e.getMessage());
        } catch (Exception e) {
            // Never crash because of a cache write failure.
            // The source of truth is always PostgreSQL.
            log.warn("Failed to cache snapshot for session {}: {}",
                    sessionId, e.getMessage());
        }
    }

    public SessionSnapshotDto get(UUID sessionId) {
        String key = key(sessionId);
        try {
            String cached = redisTemplate.opsForValue().get(key);
            if (cached != null && !cached.isBlank()) {
                SessionSnapshotDto snapshot = objectMapper.readValue(
                        cached, SessionSnapshotDto.class);
                log.debug("Cache HIT for session {}", sessionId);
                return snapshot;
            }
        } catch (Exception e) {
            // Cache miss or deserialization error — fall through to DB
            log.warn("Cache read failed for session {}: {}",
                    sessionId, e.getMessage());
        }
        log.debug("Cache MISS for session {}", sessionId);
        return null;
    }

    public void invalidate(UUID sessionId) {
        try {
            redisTemplate.delete(key(sessionId));
            log.debug("Invalidated snapshot cache for session {}", sessionId);
        } catch (Exception e) {
            log.warn("Failed to invalidate cache for session {}: {}",
                    sessionId, e.getMessage());
        }
    }

    private String key(UUID sessionId) {
        return KEY_PREFIX + sessionId;
    }
}
