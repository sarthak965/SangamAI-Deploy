package com.sangam.ai.workspace;

import com.sangam.ai.common.response.ApiResponse;
import com.sangam.ai.user.User;
import com.sangam.ai.workspace.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/workspace")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    @GetMapping("/projects")
    public ResponseEntity<ApiResponse<List<ProjectResponse>>> listProjects(
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(workspaceService.listProjects(currentUser)));
    }

    @PostMapping("/projects")
    public ResponseEntity<ApiResponse<ProjectResponse>> createProject(
            @Valid @RequestBody ProjectUpsertRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(workspaceService.createProject(request, currentUser)));
    }

    @PutMapping("/projects/{projectId}")
    public ResponseEntity<ApiResponse<ProjectResponse>> updateProject(
            @PathVariable UUID projectId,
            @Valid @RequestBody ProjectUpsertRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                workspaceService.updateProject(projectId, request, currentUser)
        ));
    }

    @GetMapping("/chats")
    public ResponseEntity<ApiResponse<List<SoloChatSummaryResponse>>> listChats(
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(workspaceService.listChats(currentUser)));
    }

    @GetMapping("/chats/recent")
    public ResponseEntity<ApiResponse<List<SoloChatSummaryResponse>>> listRecentChats(
            @RequestParam(defaultValue = "10") int limit,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                workspaceService.listRecentChats(currentUser, limit)
        ));
    }

    @PostMapping("/chats")
    public ResponseEntity<ApiResponse<SoloChatDetailResponse>> createChat(
            @Valid @RequestBody(required = false) CreateSoloChatRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        CreateSoloChatRequest safeRequest = request == null
                ? new CreateSoloChatRequest(null, null)
                : request;

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(
                workspaceService.createChat(safeRequest, currentUser)
        ));
    }

    @GetMapping("/chats/{chatId}")
    public ResponseEntity<ApiResponse<SoloChatDetailResponse>> getChat(
            @PathVariable UUID chatId,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                workspaceService.getChat(chatId, currentUser)
        ));
    }

    @PatchMapping("/chats/{chatId}")
    public ResponseEntity<ApiResponse<SoloChatDetailResponse>> updateChat(
            @PathVariable UUID chatId,
            @RequestBody UpdateSoloChatRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                workspaceService.updateChat(chatId, request, currentUser)
        ));
    }

    @DeleteMapping("/chats/{chatId}")
    public ResponseEntity<ApiResponse<Void>> deleteChat(
            @PathVariable UUID chatId,
            @AuthenticationPrincipal User currentUser
    ) {
        workspaceService.removeChat(chatId, currentUser);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping("/chats/{chatId}/messages")
    public ResponseEntity<ApiResponse<SoloChatDetailResponse>> sendMessage(
            @PathVariable UUID chatId,
            @Valid @RequestBody SendSoloMessageRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        SoloChatDetailResponse chat = workspaceService.sendMessage(chatId, request, currentUser);
        return ResponseEntity.ok(ApiResponse.ok(chat));
    }
}
