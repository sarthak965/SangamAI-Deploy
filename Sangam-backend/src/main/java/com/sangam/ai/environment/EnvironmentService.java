package com.sangam.ai.environment;

import com.sangam.ai.environment.dto.*;
import com.sangam.ai.realtime.CentrifugoService;
import com.sangam.ai.user.User;
import com.sangam.ai.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EnvironmentService {

    private final EnvironmentRepository environmentRepository;
    private final EnvironmentMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final CentrifugoService centrifugoService;

    /**
     * Creates a new environment and automatically adds the creator as the owner
     * plus an administrative co-host member row for membership-based lookups.
     */
    @Transactional
    public EnvironmentResponse createEnvironment(CreateEnvironmentRequest request, User host) {

        Environment environment = Environment.builder()
                .name(request.name())
                .description(request.description())
                .host(host)
                .inviteCode(generateUniqueInviteCode())
                .build();

        Environment saved = environmentRepository.save(environment);

        // Owner also gets a co-host membership row so membership queries work uniformly.
        EnvironmentMember hostMember = EnvironmentMember.builder()
                .environment(saved)
                .user(host)
                .role(EnvironmentMember.Role.CO_HOST)
                .canInteractWithAi(true)
                .build();

        memberRepository.save(hostMember);

        return EnvironmentResponse.from(saved);
    }

    /**
     * Lets a user join an environment using its invite code.
     */
    @Transactional
    public EnvironmentResponse joinByInviteCode(String inviteCode, User user) {

        Environment environment = environmentRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new IllegalArgumentException("Invalid invite code"));

        if (memberRepository.existsByEnvironmentIdAndUserId(
                environment.getId(), user.getId())) {
            throw new IllegalArgumentException("You are already a member of this environment");
        }

        EnvironmentMember member = EnvironmentMember.builder()
                .environment(environment)
                .user(user)
                .role(EnvironmentMember.Role.MEMBER)
                .canInteractWithAi(false)  // owner or co-host must explicitly grant this
                .build();

        EnvironmentMember savedMember = memberRepository.save(member);
        MemberResponse response = MemberResponse.from(savedMember, false);

        centrifugoService.publishEnvironmentEvent(environment.getId(), new java.util.HashMap<>() {{
            put("type", "member_added");
            put("username", savedMember.getUser().getUsername());
            put("displayName", savedMember.getUser().getDisplayName());
            put("role", response.role());
            put("owner", response.owner());
            put("canInteractWithAi", response.canInteractWithAi());
        }});

        return EnvironmentResponse.from(environment);
    }

    /**
     * Returns all members of an environment.
     * Only members of the environment can call this.
     */
    public List<MemberResponse> getMembers(UUID environmentId, User requestingUser) {
        assertIsMember(environmentId, requestingUser);

        Environment environment = environmentRepository.findById(environmentId)
                .orElseThrow(() -> new IllegalArgumentException("Environment not found"));

        return memberRepository.findByEnvironmentId(environmentId)
                .stream()
                .map(member -> MemberResponse.from(
                        member,
                        environment.getHost().getId().equals(member.getUser().getId())))
                .toList();
    }

    /**
     * Owner or co-host adds an existing user to the environment by username.
     */
    @Transactional
    public MemberResponse addMemberByUsername(UUID environmentId,
                                              AddMemberRequest request,
                                              User requestingUser) {
        Environment environment = assertCanManageEnvironment(environmentId, requestingUser);

        User targetUser = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (memberRepository.existsByEnvironmentIdAndUserId(environmentId, targetUser.getId())) {
            throw new IllegalArgumentException("User is already a member of this environment");
        }

        EnvironmentMember member = EnvironmentMember.builder()
                .environment(environment)
                .user(targetUser)
                .role(EnvironmentMember.Role.MEMBER)
                .canInteractWithAi(false)
                .build();

        EnvironmentMember savedMember = memberRepository.save(member);
        MemberResponse response = MemberResponse.from(savedMember, false);

        centrifugoService.publishEnvironmentEvent(environmentId, new java.util.HashMap<>() {{
            put("type", "member_added");
            put("username", savedMember.getUser().getUsername());
            put("displayName", savedMember.getUser().getDisplayName());
            put("role", response.role());
            put("owner", response.owner());
            put("canInteractWithAi", response.canInteractWithAi());
        }});

        return response;
    }

    /**
     * Owner can promote or demote members between CO_HOST and MEMBER.
     */
    @Transactional
    public MemberResponse updateMemberRole(UUID environmentId,
                                           UpdateMemberRoleRequest request,
                                           User requestingUser) {
        Environment environment = assertIsOwner(environmentId, requestingUser);

        User targetUser = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        EnvironmentMember member = memberRepository
                .findByEnvironmentIdAndUserId(environmentId, targetUser.getId())
                .orElseThrow(() -> new IllegalArgumentException("User is not a member"));

        if (environment.getHost().getId().equals(targetUser.getId())) {
            throw new IllegalArgumentException("Owner role cannot be changed here");
        }

        member.setRole(mapRole(request.role()));
        if (member.getRole() == EnvironmentMember.Role.CO_HOST) {
            member.setCanInteractWithAi(true);
        }

        EnvironmentMember savedMember = memberRepository.save(member);
        MemberResponse response = MemberResponse.from(savedMember, false);

        centrifugoService.publishEnvironmentEvent(environmentId, new java.util.HashMap<>() {{
            put("type", "member_role_updated");
            put("username", savedMember.getUser().getUsername());
            put("role", response.role());
            put("owner", response.owner());
            put("canInteractWithAi", response.canInteractWithAi());
        }});

        return response;
    }

    /**
     * Owner or co-host updates whether a member can interact with the AI.
     */
    @Transactional
    public MemberResponse updateMemberPermission(UUID environmentId,
                                                 UpdatePermissionRequest request,
                                                 User requestingUser) {
        Environment environment = assertCanManageEnvironment(environmentId, requestingUser);

        User targetUser = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (environment.getHost().getId().equals(targetUser.getId())) {
            throw new IllegalArgumentException("Owner always has AI access");
        }

        EnvironmentMember member = memberRepository
                .findByEnvironmentIdAndUserId(environmentId, targetUser.getId())
                .orElseThrow(() -> new IllegalArgumentException("User is not a member"));

        if (member.getRole() == EnvironmentMember.Role.CO_HOST && !request.canInteractWithAi()) {
            throw new IllegalArgumentException("Co-hosts must retain AI access");
        }

        member.setCanInteractWithAi(request.canInteractWithAi());
        EnvironmentMember savedMember = memberRepository.save(member);
        MemberResponse response = MemberResponse.from(savedMember, false);

        centrifugoService.publishEnvironmentEvent(environmentId, new java.util.HashMap<>() {{
            put("type", "member_permission_updated");
            put("username", savedMember.getUser().getUsername());
            put("role", response.role());
            put("owner", response.owner());
            put("canInteractWithAi", response.canInteractWithAi());
        }});

        return response;
    }

    /**
     * Returns all environments the current user belongs to.
     */
    public List<EnvironmentResponse> getMyEnvironments(User user) {
        List<UUID> visibleEnvironmentIds = memberRepository.findByUserId(user.getId())
                .stream()
                .map(m -> m.getEnvironment().getId())
                .distinct()
                .toList();

        return environmentRepository.findByIdInAndHiddenFalse(visibleEnvironmentIds)
                .stream()
                .map(EnvironmentResponse::from)
                .toList();
    }

    // ---- private helpers ----

    private void assertIsMember(UUID environmentId, User user) {
        if (!memberRepository.existsByEnvironmentIdAndUserId(environmentId, user.getId())) {
            throw new SecurityException("You are not a member of this environment");
        }
    }

    private Environment assertCanManageEnvironment(UUID environmentId, User user) {
        Environment environment = environmentRepository.findById(environmentId)
                .orElseThrow(() -> new IllegalArgumentException("Environment not found"));

        EnvironmentMember member = memberRepository
                .findByEnvironmentIdAndUserId(environmentId, user.getId())
                .orElseThrow(() -> new SecurityException("You are not a member"));

        if (environment.getHost().getId().equals(user.getId())
                || member.getRole() == EnvironmentMember.Role.CO_HOST) {
            return environment;
        }

        throw new SecurityException("Only the owner or a co-host can do this");
    }

    private Environment assertIsOwner(UUID environmentId, User user) {
        Environment environment = environmentRepository.findById(environmentId)
                .orElseThrow(() -> new IllegalArgumentException("Environment not found"));

        if (!environment.getHost().getId().equals(user.getId())) {
            throw new SecurityException("Only the environment owner can do this");
        }

        return environment;
    }

    private EnvironmentMember.Role mapRole(UpdateMemberRoleRequest.Role role) {
        return switch (role) {
            case CO_HOST -> EnvironmentMember.Role.CO_HOST;
            case MEMBER -> EnvironmentMember.Role.MEMBER;
        };
    }

    private String generateUniqueInviteCode() {
        String code;
        // Keep generating until we find one that doesn't exist.
        // Collision probability is extremely low with 8 hex chars (4 billion combinations).
        do {
            code = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        } while (environmentRepository.existsByInviteCode(code));
        return code;
    }
}
