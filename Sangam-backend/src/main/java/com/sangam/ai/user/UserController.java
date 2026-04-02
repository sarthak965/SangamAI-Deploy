package com.sangam.ai.user;

import com.sangam.ai.common.response.ApiResponse;
import com.sangam.ai.friend.FriendService;
import com.sangam.ai.friend.dto.UserProfileResponse;
import com.sangam.ai.user.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final FriendService friendService;
    private final UserRepository userRepository;
    private final UserAvatarStorageService userAvatarStorageService;

    /**
     * GET /api/users/me
     *
     * Returns the currently logged-in user's profile.
     * The frontend calls this on app load to know who is logged in.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<CurrentUserResponse>> getCurrentUser(
            @AuthenticationPrincipal User currentUser) {

        return ResponseEntity.ok(ApiResponse.ok(userService.getCurrentUser(currentUser)));
    }

    @PatchMapping("/me/display-name")
    public ResponseEntity<ApiResponse<CurrentUserResponse>> updateDisplayName(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody UpdateDisplayNameRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                userService.updateDisplayName(currentUser, request)
        ));
    }

    @PatchMapping("/me/username")
    public ResponseEntity<ApiResponse<ProfileUpdateResponse>> updateUsername(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody UpdateUsernameRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                userService.updateUsername(currentUser, request)
        ));
    }

    @PatchMapping("/me/appearance")
    public ResponseEntity<ApiResponse<CurrentUserResponse>> updateAppearance(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody UpdateAppearancePreferenceRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                userService.updateAppearancePreference(currentUser, request)
        ));
    }

    @PatchMapping("/me/password")
    public ResponseEntity<ApiResponse<Void>> updatePassword(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody UpdatePasswordRequest request
    ) {
        userService.updatePassword(currentUser, request);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<CurrentUserResponse>> updateAvatar(
            @AuthenticationPrincipal User currentUser,
            @RequestPart("avatar") MultipartFile avatar
    ) throws java.io.IOException {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(
                userService.updateAvatar(currentUser, avatar)
        ));
    }

    @DeleteMapping("/me/avatar")
    public ResponseEntity<ApiResponse<CurrentUserResponse>> removeAvatar(
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                userService.removeAvatar(currentUser)
        ));
    }

    @DeleteMapping("/me")
    public ResponseEntity<ApiResponse<Void>> deleteAccount(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody DeleteAccountRequest request
    ) {
        userService.deleteAccount(currentUser, request);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @GetMapping("/{userId}/avatar")
    public ResponseEntity<Resource> getAvatar(@PathVariable UUID userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        Resource resource = userAvatarStorageService.loadAsResource(user.getAvatarPath());
        if (resource == null || !resource.exists()) {
            return ResponseEntity.notFound().build();
        }

        MediaType mediaType = userAvatarStorageService.determineMediaType(user.getAvatarPath());
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                .contentType(mediaType)
                .body(resource);
    }

    @GetMapping("/username/{username}/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfileByUsername(
            @PathVariable String username,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                friendService.getProfileByUsername(username, currentUser)
        ));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<java.util.List<com.sangam.ai.friend.dto.FriendUserResponse>>> searchUsers(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "false") boolean excludeFriends,
            @AuthenticationPrincipal User currentUser
    ) {
        String normalized = query == null ? "" : query.trim();

        java.util.Set<UUID> friendIds = friendService.getOverview(currentUser).friends().stream()
                .map(com.sangam.ai.friend.dto.FriendUserResponse::id)
                .collect(java.util.stream.Collectors.toSet());

        java.util.List<com.sangam.ai.friend.dto.FriendUserResponse> users = userRepository
                .findTop12ByUsernameContainingIgnoreCaseOrDisplayNameContainingIgnoreCaseOrderByUsernameAsc(
                        normalized,
                        normalized
                )
                .stream()
                .filter(user -> !user.getId().equals(currentUser.getId()))
                .filter(user -> !excludeFriends || !friendIds.contains(user.getId()))
                .map(com.sangam.ai.friend.dto.FriendUserResponse::from)
                .toList();

        return ResponseEntity.ok(ApiResponse.ok(users));
    }
}
