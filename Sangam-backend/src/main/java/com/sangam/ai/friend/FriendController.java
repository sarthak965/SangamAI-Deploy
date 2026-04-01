package com.sangam.ai.friend;

import com.sangam.ai.common.response.ApiResponse;
import com.sangam.ai.friend.dto.*;
import com.sangam.ai.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
public class FriendController {

    private final FriendService friendService;

    @GetMapping
    public ResponseEntity<ApiResponse<FriendsOverviewResponse>> getOverview(
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(friendService.getOverview(currentUser)));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<java.util.List<FriendUserResponse>>> searchFriends(
            @RequestParam(defaultValue = "") String query,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(friendService.searchFriends(currentUser, query)));
    }

    @PostMapping("/requests")
    public ResponseEntity<ApiResponse<FriendRequestResponse>> sendRequest(
            @Valid @RequestBody CreateFriendRequestRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(friendService.sendRequest(request, currentUser)));
    }

    @PostMapping("/requests/{requestId}/accept")
    public ResponseEntity<ApiResponse<FriendUserResponse>> acceptRequest(
            @PathVariable UUID requestId,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(friendService.acceptRequest(requestId, currentUser)));
    }

    @DeleteMapping("/requests/{requestId}")
    public ResponseEntity<ApiResponse<Void>> declineOrCancelRequest(
            @PathVariable UUID requestId,
            @RequestParam(defaultValue = "incoming") String direction,
            @AuthenticationPrincipal User currentUser
    ) {
        if ("outgoing".equalsIgnoreCase(direction)) {
            friendService.cancelOutgoingRequest(requestId, currentUser);
        } else {
            friendService.declineIncomingRequest(requestId, currentUser);
        }
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<ApiResponse<Void>> removeFriend(
            @PathVariable UUID userId,
            @AuthenticationPrincipal User currentUser
    ) {
        friendService.removeFriend(userId, currentUser);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
