package com.sangam.ai.friend.dto;

import java.util.List;

public record FriendsOverviewResponse(
        List<FriendUserResponse> friends,
        List<FriendRequestResponse> incomingRequests,
        List<FriendRequestResponse> outgoingRequests
) {
}
