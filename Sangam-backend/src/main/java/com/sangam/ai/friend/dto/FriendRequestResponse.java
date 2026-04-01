package com.sangam.ai.friend.dto;

import com.sangam.ai.friend.FriendRequest;

import java.time.Instant;
import java.util.UUID;

public record FriendRequestResponse(
        UUID id,
        FriendUserResponse user,
        String direction,
        String status,
        Instant createdAt
) {
    public static FriendRequestResponse incoming(FriendRequest request) {
        return new FriendRequestResponse(
                request.getId(),
                FriendUserResponse.from(request.getRequester()),
                "INCOMING",
                request.getStatus().name(),
                request.getCreatedAt()
        );
    }

    public static FriendRequestResponse outgoing(FriendRequest request) {
        return new FriendRequestResponse(
                request.getId(),
                FriendUserResponse.from(request.getReceiver()),
                "OUTGOING",
                request.getStatus().name(),
                request.getCreatedAt()
        );
    }
}
