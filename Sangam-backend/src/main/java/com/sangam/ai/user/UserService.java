package com.sangam.ai.user;

import com.sangam.ai.auth.JwtService;
import com.sangam.ai.environment.Environment;
import com.sangam.ai.environment.EnvironmentRepository;
import com.sangam.ai.user.dto.*;
import com.sangam.ai.workspace.Project;
import com.sangam.ai.workspace.ProjectFileRepository;
import com.sangam.ai.workspace.ProjectFileStorageService;
import com.sangam.ai.workspace.ProjectRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final EnvironmentRepository environmentRepository;
    private final ProjectRepository projectRepository;
    private final ProjectFileRepository projectFileRepository;
    private final ProjectFileStorageService projectFileStorageService;
    private final UserAvatarStorageService userAvatarStorageService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public CurrentUserResponse getCurrentUser(User currentUser) {
        return CurrentUserResponse.from(currentUser);
    }

    @Transactional
    public CurrentUserResponse updateDisplayName(User currentUser, UpdateDisplayNameRequest request) {
        currentUser.setDisplayName(request.displayName().trim());
        return CurrentUserResponse.from(userRepository.save(currentUser));
    }

    @Transactional
    public ProfileUpdateResponse updateUsername(User currentUser, UpdateUsernameRequest request) {
        String normalized = request.username().trim();
        if (userRepository.existsByUsernameAndIdNot(normalized, currentUser.getId())) {
            throw new IllegalArgumentException("Username already taken");
        }

        currentUser.setUsername(normalized);
        User saved = userRepository.save(currentUser);
        return new ProfileUpdateResponse(CurrentUserResponse.from(saved), jwtService.generateToken(saved));
    }

    @Transactional
    public CurrentUserResponse updateAppearancePreference(
            User currentUser,
            UpdateAppearancePreferenceRequest request
    ) {
        currentUser.setAppearancePreference(parseAppearancePreference(request.appearancePreference()));
        return CurrentUserResponse.from(userRepository.save(currentUser));
    }

    @Transactional
    public void updatePassword(User currentUser, UpdatePasswordRequest request) {
        String current = request.currentPassword();
        String next = request.newPassword();

        if (!passwordEncoder.matches(current, currentUser.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        if (passwordEncoder.matches(next, currentUser.getPassword())) {
            throw new IllegalArgumentException("New password must be different from the current password");
        }

        currentUser.setPasswordHash(passwordEncoder.encode(next));
        userRepository.save(currentUser);
    }

    @Transactional
    public CurrentUserResponse updateAvatar(User currentUser, MultipartFile avatar) throws java.io.IOException {
        UserAvatarStorageService.StoredAvatar stored = userAvatarStorageService.store(currentUser.getId(), avatar);
        String previousAvatarPath = currentUser.getAvatarPath();
        currentUser.setAvatarPath(stored.getRelativePath());
        User saved = userRepository.save(currentUser);
        userAvatarStorageService.delete(previousAvatarPath);
        return CurrentUserResponse.from(saved);
    }

    @Transactional
    public CurrentUserResponse removeAvatar(User currentUser) {
        String previousAvatarPath = currentUser.getAvatarPath();
        currentUser.setAvatarPath(null);
        User saved = userRepository.save(currentUser);
        userAvatarStorageService.delete(previousAvatarPath);
        return CurrentUserResponse.from(saved);
    }

    @Transactional
    public void deleteAccount(User currentUser, DeleteAccountRequest request) {
        if (!"DELETE".equalsIgnoreCase(request.confirmationText().trim())) {
            throw new IllegalArgumentException("Type DELETE to confirm account deletion");
        }

        List<Project> ownedProjects = projectRepository.findByOwnerOrderByUpdatedAtDesc(currentUser);
        for (Project project : ownedProjects) {
            projectFileRepository.findByProjectOrderByCreatedAtDesc(project)
                    .forEach(file -> projectFileStorageService.delete(file.getStoragePath()));
            projectFileStorageService.deleteProjectDirectory(project.getId());
        }

        List<Environment> hostedEnvironments = environmentRepository.findByHost(currentUser);
        environmentRepository.deleteAll(hostedEnvironments);

        userAvatarStorageService.delete(currentUser.getAvatarPath());
        userRepository.delete(currentUser);
    }

    private User.AppearancePreference parseAppearancePreference(String value) {
        try {
            return User.AppearancePreference.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new IllegalArgumentException("Appearance preference must be LIGHT, DARK, or SYSTEM");
        }
    }
}
