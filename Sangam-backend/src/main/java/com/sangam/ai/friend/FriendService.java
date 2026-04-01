package com.sangam.ai.friend;

import com.sangam.ai.friend.dto.*;
import com.sangam.ai.user.User;
import com.sangam.ai.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FriendService {

    private final FriendRequestRepository friendRequestRepository;
    private final UserRepository userRepository;

    public FriendsOverviewResponse getOverview(User currentUser) {
        List<FriendRequest> relatedAccepted = friendRequestRepository
                .findByStatusAndRequesterOrStatusAndReceiver(
                        FriendRequest.Status.ACCEPTED,
                        currentUser,
                        FriendRequest.Status.ACCEPTED,
                        currentUser
                );

        List<FriendUserResponse> friends = relatedAccepted.stream()
                .map(request -> request.getRequester().getId().equals(currentUser.getId())
                        ? FriendUserResponse.from(request.getReceiver())
                        : FriendUserResponse.from(request.getRequester()))
                .distinct()
                .sorted(Comparator.comparing(FriendUserResponse::displayName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        List<FriendRequestResponse> incomingRequests = friendRequestRepository
                .findByReceiverAndStatusOrderByCreatedAtDesc(currentUser, FriendRequest.Status.PENDING)
                .stream()
                .map(FriendRequestResponse::incoming)
                .toList();

        List<FriendRequestResponse> outgoingRequests = friendRequestRepository
                .findByRequesterAndStatusOrderByCreatedAtDesc(currentUser, FriendRequest.Status.PENDING)
                .stream()
                .map(FriendRequestResponse::outgoing)
                .toList();

        return new FriendsOverviewResponse(friends, incomingRequests, outgoingRequests);
    }

    @Transactional
    public FriendRequestResponse sendRequest(CreateFriendRequestRequest request, User currentUser) {
        String normalizedUsername = request.username().trim();
        User target = userRepository.findByUsername(normalizedUsername)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (target.getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("You cannot send a friend request to yourself");
        }

        FriendRequest existingOutgoing = friendRequestRepository
                .findByRequesterAndReceiver(currentUser, target)
                .orElse(null);
        if (existingOutgoing != null) {
            if (existingOutgoing.getStatus() == FriendRequest.Status.ACCEPTED) {
                throw new IllegalArgumentException("You are already friends");
            }
            throw new IllegalArgumentException("Friend request already sent");
        }

        FriendRequest inverse = friendRequestRepository.findByRequesterAndReceiver(target, currentUser)
                .orElse(null);
        if (inverse != null) {
            if (inverse.getStatus() == FriendRequest.Status.ACCEPTED) {
                throw new IllegalArgumentException("You are already friends");
            }
            throw new IllegalArgumentException("This user already sent you a request. Accept it from notifications.");
        }

        FriendRequest saved = friendRequestRepository.save(FriendRequest.builder()
                .requester(currentUser)
                .receiver(target)
                .status(FriendRequest.Status.PENDING)
                .build());

        return FriendRequestResponse.outgoing(saved);
    }

    @Transactional
    public FriendUserResponse acceptRequest(UUID requestId, User currentUser) {
        FriendRequest request = friendRequestRepository.findByIdAndReceiver(requestId, currentUser)
                .orElseThrow(() -> new IllegalArgumentException("Friend request not found"));

        if (request.getStatus() == FriendRequest.Status.ACCEPTED) {
            return FriendUserResponse.from(request.getRequester());
        }

        request.setStatus(FriendRequest.Status.ACCEPTED);
        friendRequestRepository.save(request);
        return FriendUserResponse.from(request.getRequester());
    }

    @Transactional
    public void declineIncomingRequest(UUID requestId, User currentUser) {
        FriendRequest request = friendRequestRepository.findByIdAndReceiver(requestId, currentUser)
                .orElseThrow(() -> new IllegalArgumentException("Friend request not found"));

        if (request.getStatus() == FriendRequest.Status.ACCEPTED) {
            throw new IllegalArgumentException("Accepted friendships must be removed from your friends list");
        }

        friendRequestRepository.delete(request);
    }

    @Transactional
    public void cancelOutgoingRequest(UUID requestId, User currentUser) {
        FriendRequest request = friendRequestRepository.findByIdAndRequester(requestId, currentUser)
                .orElseThrow(() -> new IllegalArgumentException("Friend request not found"));

        if (request.getStatus() == FriendRequest.Status.ACCEPTED) {
            throw new IllegalArgumentException("Accepted friendships must be removed from your friends list");
        }

        friendRequestRepository.delete(request);
    }

    @Transactional
    public void removeFriend(UUID userId, User currentUser) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Friend not found"));

        FriendRequest relationship = friendRequestRepository.findByRequesterAndReceiver(currentUser, target)
                .filter(request -> request.getStatus() == FriendRequest.Status.ACCEPTED)
                .or(() -> friendRequestRepository.findByRequesterAndReceiver(target, currentUser)
                        .filter(request -> request.getStatus() == FriendRequest.Status.ACCEPTED))
                .orElseThrow(() -> new IllegalArgumentException("Friendship not found"));

        friendRequestRepository.delete(relationship);
    }

    public UserProfileResponse getProfileByUsername(String username, User currentUser) {
        User target = userRepository.findByUsername(username.trim())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return UserProfileResponse.from(target, determineFriendshipStatus(currentUser, target));
    }

    public List<FriendUserResponse> searchFriends(User currentUser, String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase();

        return getOverview(currentUser).friends().stream()
                .filter(friend -> normalized.isBlank()
                        || friend.username().toLowerCase().contains(normalized)
                        || friend.displayName().toLowerCase().contains(normalized))
                .limit(12)
                .toList();
    }

    private String determineFriendshipStatus(User currentUser, User target) {
        if (currentUser.getId().equals(target.getId())) {
            return "SELF";
        }

        FriendRequest outgoing = friendRequestRepository.findByRequesterAndReceiver(currentUser, target)
                .orElse(null);
        if (outgoing != null) {
            return switch (outgoing.getStatus()) {
                case ACCEPTED -> "FRIENDS";
                case PENDING -> "OUTGOING_REQUEST";
            };
        }

        FriendRequest incoming = friendRequestRepository.findByRequesterAndReceiver(target, currentUser)
                .orElse(null);
        if (incoming != null) {
            return switch (incoming.getStatus()) {
                case ACCEPTED -> "FRIENDS";
                case PENDING -> "INCOMING_REQUEST";
            };
        }

        return "NONE";
    }
}
