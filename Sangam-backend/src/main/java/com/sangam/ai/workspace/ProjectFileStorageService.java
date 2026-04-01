package com.sangam.ai.workspace;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.FileVisitResult;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.text.Normalizer;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ProjectFileStorageService {

    private static final int MAX_EXTRACTED_TEXT_LENGTH = 40_000;
    private static final Set<String> TEXT_EXTENSIONS = Set.of(
            "txt", "md", "markdown", "java", "kt", "js", "ts", "tsx", "jsx",
            "py", "go", "rs", "c", "cpp", "h", "hpp", "cs", "sql", "json",
            "yaml", "yml", "xml", "html", "css", "scss", "csv", "properties",
            "env", "sh", "ps1"
    );

    private final Path rootDirectory;

    public ProjectFileStorageService(
            @Value("${app.workspace.project-files-dir:./storage/project-files}") String rootDirectory
    ) {
        this.rootDirectory = Path.of(rootDirectory).toAbsolutePath().normalize();
    }

    public StoredProjectFile store(UUID projectId, MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload an empty file");
        }

        Files.createDirectories(rootDirectory);
        Path projectDirectory = rootDirectory.resolve(projectId.toString()).normalize();
        Files.createDirectories(projectDirectory);

        String originalName = sanitizeFilename(file.getOriginalFilename());
        String extension = getExtension(originalName);
        String storedName = UUID.randomUUID() + (extension.isBlank() ? "" : "." + extension);
        Path destination = projectDirectory.resolve(storedName).normalize();

        if (!destination.startsWith(projectDirectory)) {
            throw new IllegalArgumentException("Invalid file path");
        }

        try (var inputStream = file.getInputStream()) {
            Files.copy(inputStream, destination, StandardCopyOption.REPLACE_EXISTING);
        }

        String extractedText = extractText(file, extension);
        return new StoredProjectFile(
                originalName,
                storedName,
                rootDirectory.relativize(destination).toString().replace('\\', '/'),
                file.getContentType(),
                file.getSize(),
                extractedText
        );
    }

    public void delete(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return;
        }

        try {
            Path target = rootDirectory.resolve(relativePath).normalize();
            if (target.startsWith(rootDirectory)) {
                Files.deleteIfExists(target);
            }
        } catch (IOException ignored) {
            // Best-effort cleanup.
        }
    }

    public void deleteProjectDirectory(UUID projectId) {
        Path projectDirectory = rootDirectory.resolve(projectId.toString()).normalize();
        if (!projectDirectory.startsWith(rootDirectory) || !Files.exists(projectDirectory)) {
            return;
        }

        try {
            Files.walkFileTree(projectDirectory, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.deleteIfExists(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                    Files.deleteIfExists(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException ignored) {
            // Best-effort cleanup.
        }
    }

    private String extractText(MultipartFile file, String extension) throws IOException {
        String contentType = file.getContentType();
        boolean looksTextual = (contentType != null && contentType.startsWith("text/"))
                || TEXT_EXTENSIONS.contains(extension);

        if (!looksTextual) {
            return "";
        }

        String content = new String(file.getBytes(), StandardCharsets.UTF_8)
                .replace("\u0000", "")
                .trim();

        if (content.length() <= MAX_EXTRACTED_TEXT_LENGTH) {
            return content;
        }

        return content.substring(0, MAX_EXTRACTED_TEXT_LENGTH);
    }

    private String sanitizeFilename(String rawName) {
        String fallback = "file";
        if (rawName == null || rawName.isBlank()) {
            return fallback;
        }

        String normalized = Normalizer.normalize(rawName, Normalizer.Form.NFKC)
                .replace("\\", "_")
                .replace("/", "_")
                .replaceAll("\\s+", " ")
                .trim();

        return normalized.isBlank() ? fallback : normalized;
    }

    private String getExtension(String name) {
        int dotIndex = name.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == name.length() - 1) {
            return "";
        }
        return name.substring(dotIndex + 1).toLowerCase();
    }

    @Getter
    public static class StoredProjectFile {
        private final String originalName;
        private final String storedName;
        private final String storagePath;
        private final String contentType;
        private final long sizeBytes;
        private final String extractedText;

        public StoredProjectFile(
                String originalName,
                String storedName,
                String storagePath,
                String contentType,
                long sizeBytes,
                String extractedText
        ) {
            this.originalName = originalName;
            this.storedName = storedName;
            this.storagePath = storagePath;
            this.contentType = contentType;
            this.sizeBytes = sizeBytes;
            this.extractedText = extractedText;
        }
    }
}
