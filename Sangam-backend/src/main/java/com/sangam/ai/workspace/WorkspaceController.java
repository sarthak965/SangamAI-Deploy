package com.sangam.ai.workspace;

import com.sangam.ai.common.response.ApiResponse;
import com.sangam.ai.user.User;
import com.sangam.ai.workspace.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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

    @DeleteMapping("/projects/{projectId}")
    public ResponseEntity<ApiResponse<Void>> deleteProject(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal User currentUser
    ) {
        workspaceService.removeProject(projectId, currentUser);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @GetMapping("/projects/{projectId}/memory")
    public ResponseEntity<ApiResponse<List<ProjectMemoryEntryResponse>>> listProjectMemory(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                workspaceService.listProjectMemoryEntries(projectId, currentUser)
        ));
    }

    @GetMapping("/projects/{projectId}/members")
    public ResponseEntity<ApiResponse<List<ProjectMemberResponse>>> listProjectMembers(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                workspaceService.listProjectMembers(projectId, currentUser)
        ));
    }

    @PostMapping("/projects/{projectId}/memory")
    public ResponseEntity<ApiResponse<ProjectMemoryEntryResponse>> addProjectMemory(
            @PathVariable UUID projectId,
            @Valid @RequestBody ProjectMemoryEntryRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(
                workspaceService.addProjectMemoryEntry(projectId, request, currentUser)
        ));
    }

    @GetMapping("/projects/{projectId}/chats")
    public ResponseEntity<ApiResponse<List<SoloChatSummaryResponse>>> listProjectChats(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                workspaceService.listProjectChats(projectId, currentUser)
        ));
    }

    @PostMapping("/projects/{projectId}/chats")
    public ResponseEntity<ApiResponse<SoloChatDetailResponse>> createProjectChat(
            @PathVariable UUID projectId,
            @Valid @RequestBody(required = false) CreateSoloChatRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        CreateSoloChatRequest safeRequest = request == null
                ? new CreateSoloChatRequest(null, null)
                : request;

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(
                workspaceService.createProjectChat(projectId, safeRequest, currentUser)
        ));
    }

    @GetMapping("/projects/{projectId}/files")
    public ResponseEntity<ApiResponse<List<ProjectFileResponse>>> listProjectFiles(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                workspaceService.listProjectFiles(projectId, currentUser)
        ));
    }

    @PostMapping(
            value = "/projects/{projectId}/files",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<ApiResponse<List<ProjectFileResponse>>> uploadProjectFiles(
            @PathVariable UUID projectId,
            @RequestPart("files") List<MultipartFile> files,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(
                workspaceService.uploadProjectFiles(projectId, files, currentUser)
        ));
    }

    @DeleteMapping("/projects/{projectId}/files/{fileId}")
    public ResponseEntity<ApiResponse<Void>> deleteProjectFile(
            @PathVariable UUID projectId,
            @PathVariable UUID fileId,
            @AuthenticationPrincipal User currentUser
    ) {
        workspaceService.removeProjectFile(projectId, fileId, currentUser);
        return ResponseEntity.ok(ApiResponse.ok(null));
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
