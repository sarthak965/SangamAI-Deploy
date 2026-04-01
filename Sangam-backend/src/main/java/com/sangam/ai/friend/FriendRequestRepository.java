package com.sangam.ai.friend;

import com.sangam.ai.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, UUID> {
    List<FriendRequest> findByReceiverAndStatusOrderByCreatedAtDesc(User receiver, FriendRequest.Status status);
    List<FriendRequest> findByRequesterAndStatusOrderByCreatedAtDesc(User requester, FriendRequest.Status status);
    List<FriendRequest> findByStatusAndRequesterOrStatusAndReceiver(
            FriendRequest.Status requesterStatus,
            User requester,
            FriendRequest.Status receiverStatus,
            User receiver
    );
    Optional<FriendRequest> findByRequesterAndReceiver(User requester, User receiver);
    Optional<FriendRequest> findByIdAndReceiver(UUID id, User receiver);
    Optional<FriendRequest> findByIdAndRequester(UUID id, User requester);
    boolean existsByRequesterAndReceiverAndStatus(User requester, User receiver, FriendRequest.Status status);
}
