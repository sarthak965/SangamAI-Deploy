package com.sangam.ai.user;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.util.Set;
import java.util.UUID;

@Service
public class UserAvatarStorageService {

    private static final long MAX_AVATAR_SIZE_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("png", "jpg", "jpeg", "webp", "gif");

    private final Path rootDirectory;

    public UserAvatarStorageService(
            @Value("${app.user.avatar-dir:./storage/avatars}") String rootDirectory
    ) {
        this.rootDirectory = Path.of(rootDirectory).toAbsolutePath().normalize();
    }

    public StoredAvatar store(UUID userId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Select an image to upload");
        }
        if (file.getSize() > MAX_AVATAR_SIZE_BYTES) {
            throw new IllegalArgumentException("Avatar must be 5 MB or smaller");
        }

        String extension = getExtension(sanitizeFilename(file.getOriginalFilename()));
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("Avatar must be a PNG, JPG, WEBP, or GIF image");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new IllegalArgumentException("Only image uploads are allowed for avatars");
        }

        Files.createDirectories(rootDirectory);
        String storedName = userId + "-" + UUID.randomUUID() + "." + extension;
        Path destination = rootDirectory.resolve(storedName).normalize();
        if (!destination.startsWith(rootDirectory)) {
            throw new IllegalArgumentException("Invalid avatar path");
        }

        try (var inputStream = file.getInputStream()) {
            Files.copy(inputStream, destination, StandardCopyOption.REPLACE_EXISTING);
        }

        return new StoredAvatar(
                rootDirectory.relativize(destination).toString().replace('\\', '/'),
                contentType
        );
    }

    public Resource loadAsResource(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return null;
        }

        Path file = rootDirectory.resolve(relativePath).normalize();
        if (!file.startsWith(rootDirectory) || !Files.exists(file)) {
            return null;
        }

        return new FileSystemResource(file);
    }

    public MediaType determineMediaType(String relativePath) {
        try {
            Path file = rootDirectory.resolve(relativePath).normalize();
            String mime = Files.probeContentType(file);
            return mime != null ? MediaType.parseMediaType(mime) : MediaType.APPLICATION_OCTET_STREAM;
        } catch (Exception ignored) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    public void delete(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return;
        }

        try {
            Path file = rootDirectory.resolve(relativePath).normalize();
            if (file.startsWith(rootDirectory)) {
                Files.deleteIfExists(file);
            }
        } catch (IOException ignored) {
            // Best-effort cleanup.
        }
    }

    private String sanitizeFilename(String rawName) {
        if (rawName == null || rawName.isBlank()) {
            return "avatar.png";
        }

        String normalized = Normalizer.normalize(rawName, Normalizer.Form.NFKC)
                .replace("\\", "_")
                .replace("/", "_")
                .trim();

        return normalized.isBlank() ? "avatar.png" : normalized;
    }

    private String getExtension(String name) {
        int dotIndex = name.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == name.length() - 1) {
            return "";
        }
        return name.substring(dotIndex + 1).toLowerCase();
    }

    @Getter
    public static class StoredAvatar {
        private final String relativePath;
        private final String contentType;

        public StoredAvatar(String relativePath, String contentType) {
            this.relativePath = relativePath;
            this.contentType = contentType;
        }
    }
}
