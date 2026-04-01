package com.sangam.ai.workspace;

import com.sangam.ai.ai.AiMessage;
import com.sangam.ai.ai.AiProvider;
import com.sangam.ai.ai.PromptPolicyService;
import com.sangam.ai.environment.Environment;
import com.sangam.ai.environment.EnvironmentMember;
import com.sangam.ai.environment.EnvironmentMemberRepository;
import com.sangam.ai.environment.EnvironmentRepository;
import com.sangam.ai.realtime.CentrifugoService;
import com.sangam.ai.user.User;
import com.sangam.ai.user.UserRepository;
import com.sangam.ai.workspace.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectMemoryEntryRepository projectMemoryEntryRepository;
    private final ProjectFileRepository projectFileRepository;
    private final SoloChatRepository soloChatRepository;
    private final SoloChatMessageRepository soloChatMessageRepository;
    private final EnvironmentRepository environmentRepository;
    private final EnvironmentMemberRepository environmentMemberRepository;
    private final UserRepository userRepository;
    private final AiProvider aiProvider;
    private final PromptPolicyService promptPolicyService;
    private final CentrifugoService centrifugoService;
    private final TransactionTemplate transactionTemplate;
    private final ProjectFileStorageService projectFileStorageService;

    public List<ProjectResponse> listProjects(User user) {
        return projectRepository.findVisibleProjects(user)
                .stream()
                .map(this::toProjectResponse)
                .toList();
    }

    @Transactional
    public ProjectResponse createProject(ProjectUpsertRequest request, User user) {
        Project.Type projectType = parseProjectType(request.type());
        Environment environment = null;
        if (projectType == Project.Type.GROUP) {
            environment = environmentRepository.save(Environment.builder()
                    .name(request.name().trim())
                    .description(normalizeNullable(request.description()))
                    .host(user)
                    .inviteCode(generateHiddenEnvironmentCode())
                    .hidden(true)
                    .build());
        }

        Project project = Project.builder()
                .owner(user)
                .type(projectType)
                .environment(environment)
                .name(request.name().trim())
                .description(normalizeNullable(request.description()))
                .systemInstructions(normalizeText(request.systemInstructions()))
                .knowledgeContext(normalizeText(request.knowledgeContext()))
                .build();

        Project savedProject = projectRepository.save(project);
        syncProjectMembers(savedProject, request.memberUsernames(), user);
        return toProjectResponse(savedProject);
    }

    @Transactional
    public ProjectResponse updateProject(UUID projectId, ProjectUpsertRequest request, User user) {
        Project project = getAccessibleProject(projectId, user);
        project.setName(request.name().trim());
        project.setDescription(normalizeNullable(request.description()));
        project.setSystemInstructions(normalizeText(request.systemInstructions()));
        project.setKnowledgeContext(normalizeText(request.knowledgeContext()));
        if (project.getEnvironment() != null) {
            project.getEnvironment().setName(project.getName());
            project.getEnvironment().setDescription(project.getDescription());
        }
        return toProjectResponse(projectRepository.save(project));
    }

    @Transactional
    public void removeProject(UUID projectId, User user) {
        Project project = getOwnedProject(projectId, user);

        List<SoloChat> chats = soloChatRepository.findByProject(project);
        for (SoloChat chat : chats) {
            chat.setProject(null);
            chat.setUpdatedAt(Instant.now());
        }
        soloChatRepository.saveAll(chats);

        projectFileRepository.findByProjectOrderByCreatedAtDesc(project)
                .forEach(file -> projectFileStorageService.delete(file.getStoragePath()));
        projectFileStorageService.deleteProjectDirectory(project.getId());

        projectRepository.delete(project);
    }

    public List<ProjectMemoryEntryResponse> listProjectMemoryEntries(UUID projectId, User user) {
        Project project = getAccessibleProject(projectId, user);
        return projectMemoryEntryRepository.findByProjectOrderByCreatedAtDesc(project)
                .stream()
                .map(ProjectMemoryEntryResponse::from)
                .toList();
    }

    @Transactional
    public ProjectMemoryEntryResponse addProjectMemoryEntry(
            UUID projectId,
            ProjectMemoryEntryRequest request,
            User user
    ) {
        Project project = getAccessibleProject(projectId, user);
        ProjectMemoryEntry entry = ProjectMemoryEntry.builder()
                .project(project)
                .content(request.content().trim())
                .build();
        return ProjectMemoryEntryResponse.from(projectMemoryEntryRepository.save(entry));
    }

    public List<ProjectFileResponse> listProjectFiles(UUID projectId, User user) {
        Project project = getAccessibleProject(projectId, user);
        return projectFileRepository.findByProjectOrderByCreatedAtDesc(project)
                .stream()
                .map(ProjectFileResponse::from)
                .toList();
    }

    @Transactional
    public List<ProjectFileResponse> uploadProjectFiles(UUID projectId, List<MultipartFile> files, User user) {
        if (files == null || files.isEmpty()) {
            throw new IllegalArgumentException("Select at least one file to upload");
        }

        Project project = getAccessibleProject(projectId, user);
        List<ProjectFile> uploaded = new ArrayList<>();

        try {
            for (MultipartFile multipartFile : files) {
                ProjectFileStorageService.StoredProjectFile stored =
                        projectFileStorageService.store(project.getId(), multipartFile);

                ProjectFile file = ProjectFile.builder()
                        .project(project)
                        .originalName(stored.getOriginalName())
                        .storedName(stored.getStoredName())
                        .storagePath(stored.getStoragePath())
                        .contentType(stored.getContentType())
                        .sizeBytes(stored.getSizeBytes())
                        .extractedText(stored.getExtractedText())
                        .build();
                uploaded.add(projectFileRepository.save(file));
            }
        } catch (Exception e) {
            uploaded.forEach(file -> projectFileStorageService.delete(file.getStoragePath()));
            throw e instanceof IllegalArgumentException
                    ? (IllegalArgumentException) e
                    : new IllegalStateException("Failed to upload project files", e);
        }

        return uploaded.stream()
                .map(ProjectFileResponse::from)
                .toList();
    }

    @Transactional
    public void removeProjectFile(UUID projectId, UUID fileId, User user) {
        Project project = getAccessibleProject(projectId, user);
        ProjectFile file = projectFileRepository.findById(fileId)
                .orElseThrow(() -> new IllegalArgumentException("Project file not found"));

        if (!file.getProject().getId().equals(project.getId())) {
            throw new IllegalArgumentException("Project file does not belong to this project");
        }

        projectFileRepository.delete(file);
        projectFileStorageService.delete(file.getStoragePath());
    }

    public List<SoloChatSummaryResponse> listChats(User user) {
        return soloChatRepository.findByOwnerAndProjectIsNullOrderByPinnedDescUpdatedAtDesc(user)
                .stream()
                .map(this::toSummary)
                .toList();
    }

    public List<SoloChatSummaryResponse> listRecentChats(User user, int limit) {
        return listChats(user).stream().limit(Math.max(1, limit)).toList();
    }

    @Transactional
    public SoloChatDetailResponse createChat(CreateSoloChatRequest request, User user) {
        Project project = request.projectId() != null
                ? getAccessibleProject(request.projectId(), user)
                : null;

        if (project != null && project.getType() == Project.Type.GROUP) {
            throw new IllegalArgumentException("Group projects use sessions instead of personal chats");
        }

        SoloChat chat = SoloChat.builder()
                .owner(user)
                .project(project)
                .title(normalizeTitle(request.title()))
                .build();

        SoloChat saved = soloChatRepository.save(chat);
        return toDetail(saved);
    }

    public List<SoloChatSummaryResponse> listProjectChats(UUID projectId, User user) {
        Project project = getAccessibleProject(projectId, user);
        ensurePersonalProject(project);
        return soloChatRepository.findByProjectOrderByUpdatedAtDesc(project)
                .stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional
    public SoloChatDetailResponse createProjectChat(UUID projectId, CreateSoloChatRequest request, User user) {
        Project project = getAccessibleProject(projectId, user);
        ensurePersonalProject(project);

        SoloChat chat = SoloChat.builder()
                .owner(user)
                .project(project)
                .title(normalizeTitle(request.title()))
                .build();

        SoloChat saved = soloChatRepository.save(chat);
        return toDetail(saved);
    }

    public SoloChatDetailResponse getChat(UUID chatId, User user) {
        return toDetail(getOwnedChat(chatId, user));
    }

    @Transactional
    public SoloChatDetailResponse updateChat(UUID chatId, UpdateSoloChatRequest request, User user) {
        SoloChat chat = getOwnedChat(chatId, user);

        if (request.title() != null) {
            chat.setTitle(normalizeTitle(request.title()));
        }
        if (request.pinned() != null) {
            chat.setPinned(request.pinned());
        }
        if (request.projectId() != null) {
            Project project = getOwnedProject(request.projectId(), user);
            ensurePersonalProject(project);
            chat.setProject(project);
        }

        chat.setUpdatedAt(Instant.now());
        return toDetail(soloChatRepository.save(chat));
    }

    @Transactional
    public void removeChat(UUID chatId, User user) {
        SoloChat chat = getOwnedChat(chatId, user);
        soloChatRepository.delete(chat);
    }

    @Transactional
    public SoloChatDetailResponse sendMessage(UUID chatId, SendSoloMessageRequest request, User user) {
        SoloChat chat = getOwnedChat(chatId, user);
        String content = request.content().trim();

        SoloChatMessage userMessage = SoloChatMessage.builder()
                .chat(chat)
                .role(SoloChatMessage.Role.USER)
                .status(SoloChatMessage.Status.COMPLETE)
                .content(content)
                .build();
        soloChatMessageRepository.save(userMessage);

        if (isDefaultTitle(chat.getTitle())) {
            chat.setTitle(deriveChatTitle(content));
        }

        SoloChatMessage assistantMessage = SoloChatMessage.builder()
                .chat(chat)
                .role(SoloChatMessage.Role.ASSISTANT)
                .status(SoloChatMessage.Status.STREAMING)
                .content("")
                .build();
        soloChatMessageRepository.save(assistantMessage);

        chat.setUpdatedAt(Instant.now());
        soloChatRepository.save(chat);

        List<AiMessage> messages = buildAiMessages(chat, content);
        streamAssistantReply(chat, assistantMessage.getId(), content, messages);

        return toDetail(chat);
    }

    private void streamAssistantReply(SoloChat chat, UUID messageId, String userPrompt, List<AiMessage> messages) {
        UUID chatId = chat.getId();
        StringBuilder fullReply = new StringBuilder();

        aiProvider.streamResponse(messages)
                .doOnNext(chunk -> {
                    fullReply.append(chunk);
                    updateStreamingMessageContent(messageId, fullReply.toString());
                    centrifugoService.publishSoloChatChunk(chatId, messageId, chunk);
                })
                .doOnError(error -> {
                    log.error("Streaming failed for solo chat {}", chatId, error);
                    finalizeMessage(messageId, fullReply.toString(), SoloChatMessage.Status.COMPLETE);
                    persistProjectConversationMemory(chat, userPrompt, fullReply.toString());
                    centrifugoService.publishSoloChatComplete(chatId, messageId);
                })
                .doOnComplete(() -> {
                    finalizeMessage(messageId, fullReply.toString(), SoloChatMessage.Status.COMPLETE);
                    persistProjectConversationMemory(chat, userPrompt, fullReply.toString());
                    centrifugoService.publishSoloChatComplete(chatId, messageId);
                })
                .subscribe();
    }

    private void updateStreamingMessageContent(UUID messageId, String content) {
        transactionTemplate.executeWithoutResult(s -> {
            soloChatMessageRepository.findById(messageId).ifPresent(message -> {
                message.setContent(content);
                message.setStatus(SoloChatMessage.Status.STREAMING);
                soloChatMessageRepository.save(message);
            });
        });
    }

    private void finalizeMessage(UUID messageId, String content, SoloChatMessage.Status status) {
        transactionTemplate.executeWithoutResult(s -> {
            soloChatMessageRepository.findById(messageId).ifPresent(message -> {
                message.setContent(content);
                message.setStatus(status);
                soloChatMessageRepository.save(message);
            });
        });
    }

    private List<AiMessage> buildAiMessages(SoloChat chat, String latestUserMessage) {
        List<AiMessage> messages = new ArrayList<>();
        String projectKnowledgeContext = chat.getProject() != null
                ? buildProjectKnowledgeContext(chat.getProject())
                : "";
        messages.add(AiMessage.system(
                promptPolicyService.buildPersonalSystemPrompt(
                        chat.getProject(),
                        projectKnowledgeContext,
                        latestUserMessage
                )
        ));

        List<SoloChatMessage> history = soloChatMessageRepository.findByChatIdOrderByCreatedAtAsc(chat.getId());
        for (SoloChatMessage message : history) {
            if (message.getStatus() == SoloChatMessage.Status.STREAMING) continue;
            
            if (message.getRole() == SoloChatMessage.Role.USER) {
                messages.add(AiMessage.user(message.getContent()));
            } else if (message.getRole() == SoloChatMessage.Role.ASSISTANT) {
                messages.add(AiMessage.assistant(message.getContent()));
            }
        }

        if (history.isEmpty()
                || history.get(history.size() - 1).getRole() != SoloChatMessage.Role.USER
                || !history.get(history.size() - 1).getContent().equals(latestUserMessage)) {
            messages.add(AiMessage.user(latestUserMessage));
        }

        return messages;
    }

    private SoloChatSummaryResponse toSummary(SoloChat chat) {
        SoloChatMessage lastMessage = soloChatMessageRepository
                .findTopByChatIdOrderByCreatedAtDesc(chat.getId())
                .orElse(null);
        return SoloChatSummaryResponse.from(chat, chat.getProject(), lastMessage);
    }

    private SoloChatDetailResponse toDetail(SoloChat chat) {
        List<SoloChatMessageResponse> messages = soloChatMessageRepository
                .findByChatIdOrderByCreatedAtAsc(chat.getId())
                .stream()
                .map(SoloChatMessageResponse::from)
                .toList();

        return new SoloChatDetailResponse(
                chat.getId(),
                chat.getTitle(),
                chat.isPinned(),
                chat.getProject() != null ? toProjectResponse(chat.getProject()) : null,
                chat.getCreatedAt(),
                chat.getUpdatedAt(),
                messages
        );
    }

    public List<ProjectMemberResponse> listProjectMembers(UUID projectId, User user) {
        Project project = getAccessibleProject(projectId, user);
        return projectMemberRepository.findByProjectOrderByCreatedAtAsc(project)
                .stream()
                .map(ProjectMemberResponse::from)
                .toList();
    }

    private Project getOwnedProject(UUID projectId, User user) {
        return projectRepository.findByIdAndOwner(projectId, user)
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));
    }

    private void ensurePersonalProject(Project project) {
        if (project.getType() == Project.Type.GROUP) {
            throw new IllegalArgumentException("Group projects use sessions instead of personal chats");
        }
    }

    private Project getAccessibleProject(UUID projectId, User user) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));

        if (project.getOwner().getId().equals(user.getId())
                || projectMemberRepository.existsByProjectAndUser(project, user)) {
            return project;
        }

        throw new SecurityException("You do not have access to this project");
    }

    private SoloChat getOwnedChat(UUID chatId, User user) {
        return soloChatRepository.findByIdAndOwner(chatId, user)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
    }

    private String normalizeTitle(String title) {
        if (title == null || title.isBlank()) {
            return "New Chat";
        }
        String trimmed = title.trim();
        return trimmed.length() > 255 ? trimmed.substring(0, 255) : trimmed;
    }

    private boolean isDefaultTitle(String title) {
        return title == null || title.isBlank() || "New Chat".equalsIgnoreCase(title.trim());
    }

    private String deriveChatTitle(String prompt) {
        String normalized = prompt.replaceAll("\\s+", " ").trim();
        if (normalized.length() <= 60) {
            return normalized;
        }
        return normalized.substring(0, 60) + "...";
    }

    private String normalizeNullable(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }

    private String buildProjectKnowledgeContext(Project project) {
        StringBuilder builder = new StringBuilder();

        if (project.getKnowledgeContext() != null && !project.getKnowledgeContext().isBlank()) {
            builder.append(project.getKnowledgeContext().trim());
        }

        List<ProjectMemoryEntry> memoryEntries =
                projectMemoryEntryRepository.findByProjectOrderByCreatedAtDesc(project);
        if (!memoryEntries.isEmpty()) {
            if (!builder.isEmpty()) {
                builder.append("\n\n");
            }
            builder.append("Project memory updates:\n");
            int memoryCount = Math.min(memoryEntries.size(), 8);
            for (int i = 0; i < memoryCount; i++) {
                builder.append("- ").append(memoryEntries.get(i).getContent().trim()).append("\n");
            }
        }

        List<ProjectFile> projectFiles = projectFileRepository.findByProjectOrderByCreatedAtDesc(project);
        if (!projectFiles.isEmpty()) {
            if (!builder.isEmpty()) {
                builder.append("\n");
            }
            builder.append("\nProject files:\n");
            int includedFiles = 0;
            int remainingBudget = 18_000;
            for (ProjectFile file : projectFiles) {
                if (includedFiles >= 6 || remainingBudget <= 0) {
                    break;
                }
                if (file.getExtractedText() == null || file.getExtractedText().isBlank()) {
                    builder.append("- ").append(file.getOriginalName())
                            .append(" (attached, not text-indexed)\n");
                    continue;
                }

                String excerpt = file.getExtractedText().trim();
                if (excerpt.length() > 3_000) {
                    excerpt = excerpt.substring(0, 3_000);
                }
                if (excerpt.length() > remainingBudget) {
                    excerpt = excerpt.substring(0, remainingBudget);
                }

                builder.append("--- FILE: ").append(file.getOriginalName()).append(" ---\n")
                        .append(excerpt)
                        .append("\n");
                remainingBudget -= excerpt.length();
                includedFiles++;
            }
        }

        return builder.toString();
    }

    private void persistProjectConversationMemory(SoloChat chat, String userPrompt, String assistantReply) {
        if (chat.getProject() == null) {
            return;
        }

        String normalizedUserPrompt = normalizeMemorySnippet(userPrompt, 220);
        String normalizedAssistantReply = normalizeMemorySnippet(assistantReply, 420);
        if (normalizedUserPrompt.isBlank() && normalizedAssistantReply.isBlank()) {
            return;
        }

        StringBuilder memory = new StringBuilder("Recent project conversation update:");
        if (!normalizedUserPrompt.isBlank()) {
            memory.append("\nUser asked: ").append(normalizedUserPrompt);
        }
        if (!normalizedAssistantReply.isBlank()) {
            memory.append("\nAssistant answered: ").append(normalizedAssistantReply);
        }

        transactionTemplate.executeWithoutResult(s -> {
            Project managedProject = projectRepository.findById(chat.getProject().getId()).orElse(null);
            if (managedProject == null) {
                return;
            }

            ProjectMemoryEntry entry = ProjectMemoryEntry.builder()
                    .project(managedProject)
                    .content(memory.toString())
                    .build();
            projectMemoryEntryRepository.save(entry);
        });
    }

    private String normalizeMemorySnippet(String content, int maxLength) {
        if (content == null || content.isBlank()) {
            return "";
        }
        String normalized = content.trim().replaceAll("\\s+", " ");
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, maxLength) + "...";
    }

    private ProjectResponse toProjectResponse(Project project) {
        return ProjectResponse.from(
                project,
                projectMemberRepository.findByProjectOrderByCreatedAtAsc(project)
        );
    }

    private Project.Type parseProjectType(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            return Project.Type.PERSONAL;
        }
        try {
            return Project.Type.valueOf(rawType.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Project type must be PERSONAL or GROUP");
        }
    }

    private void syncProjectMembers(Project project, List<String> memberUsernames, User owner) {
        LinkedHashSet<User> members = new LinkedHashSet<>();
        members.add(owner);

        if (memberUsernames != null) {
            for (String username : memberUsernames) {
                if (username == null || username.isBlank()) {
                    continue;
                }
                User target = userRepository.findByUsername(username.trim())
                        .orElseThrow(() -> new IllegalArgumentException("User not found: " + username.trim()));
                members.add(target);
            }
        }

        if (project.getType() == Project.Type.GROUP && members.size() < 2) {
            throw new IllegalArgumentException("Group projects need at least one collaborator");
        }

        List<ProjectMember> projectMembers = members.stream()
                .sorted(Comparator.comparing(User::getUsername, String.CASE_INSENSITIVE_ORDER))
                .map(member -> ProjectMember.builder()
                        .project(project)
                        .user(member)
                        .role(member.getId().equals(owner.getId()) ? ProjectMember.Role.OWNER : ProjectMember.Role.MEMBER)
                        .build())
                .toList();

        projectMemberRepository.saveAll(projectMembers);

        if (project.getEnvironment() != null) {
            List<EnvironmentMember> envMembers = members.stream()
                    .map(member -> EnvironmentMember.builder()
                            .environment(project.getEnvironment())
                            .user(member)
                            .role(EnvironmentMember.Role.CO_HOST)
                            .canInteractWithAi(true)
                            .build())
                    .toList();
            environmentMemberRepository.saveAll(envMembers);
        }
    }

    private String generateHiddenEnvironmentCode() {
        String code;
        do {
            code = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        } while (environmentRepository.existsByInviteCode(code));
        return code;
    }
}
