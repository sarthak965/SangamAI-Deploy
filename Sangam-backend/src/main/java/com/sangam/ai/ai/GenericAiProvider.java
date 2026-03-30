package com.sangam.ai.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.FluxSink;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * ONE provider that works with ANY OpenAI-compatible API.
 *
 * Groq, OpenAI, Together AI, Mistral, Fireworks, Gemini (OpenAI compat),
 * Anthropic (OpenAI compat endpoint) — all use the same request/response
 * format. You just point this at a different base URL with a different key.
 *
 * To switch providers you change ONLY application.properties.
 * This class never changes.
 */
@Slf4j
@Component
public class GenericAiProvider implements AiProvider {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String model;

    public GenericAiProvider(
            @Value("${app.ai.base-url}") String baseUrl,
            @Value("${app.ai.api-key}") String apiKey,
            @Value("${app.ai.model}") String model,
            ObjectMapper objectMapper) {

        this.model = model;
        this.objectMapper = objectMapper;

        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    @Override
    public Flux<String> streamResponse(List<AiMessage> messages) {

        List<Map<String, String>> formattedMessages = messages.stream()
                .map(m -> Map.of("role", m.role(), "content", m.content()))
                .toList();

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "stream", true,
                "messages", formattedMessages
        );

        return webClient.post()
                .uri("/v1/chat/completions")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .exchangeToFlux(response -> {
                    if (response.statusCode().isError()) {
                        return response.createException().flatMapMany(Flux::error);
                    }

                    return response.bodyToFlux(DataBuffer.class)
                            .map(GenericAiProvider::toUtf8String)
                            .transform(chunks -> extractStreamingPayloads(chunks, objectMapper));
                })
                .filter(data -> !data.equals("[DONE]"))
                .flatMap(data -> {
                    try {
                        JsonNode node = objectMapper.readTree(data);
                        String text = node
                                .path("choices")
                                .path(0)
                                .path("delta")
                                .path("content")
                                .asText("");
                        return text.isEmpty() ? Flux.empty() : Flux.just(text);
                    } catch (Exception e) {
                        log.warn("Failed to parse SSE event: {}", data);
                        return Flux.empty();
                    }
                })
                .doOnError(e -> log.error("AI streaming error: {}", e.getMessage()));
    }

    private static String toUtf8String(DataBuffer dataBuffer) {
        try {
            byte[] bytes = new byte[dataBuffer.readableByteCount()];
            dataBuffer.read(bytes);
            return new String(bytes, StandardCharsets.UTF_8);
        } finally {
            DataBufferUtils.release(dataBuffer);
        }
    }

    private static Flux<String> extractStreamingPayloads(
            Flux<String> chunks, ObjectMapper objectMapper) {
        return Flux.create(sink -> {
            StringBuilder buffer = new StringBuilder();
            StringBuilder fullBody = new StringBuilder();
            AtomicBoolean emittedSseData = new AtomicBoolean(false);

            chunks.subscribe(
                    chunk -> {
                        fullBody.append(chunk);
                        buffer.append(chunk);
                        drainLines(buffer, sink, emittedSseData);
                    },
                    sink::error,
                    () -> {
                        // Drain any remaining content without requiring a trailing newline.
                        drainLines(buffer.append('\n'), sink, emittedSseData);
                        if (!emittedSseData.get()) {
                            emitNonStreamingCompletion(fullBody.toString(), objectMapper, sink);
                        }
                        sink.complete();
                    }
            );
        }, FluxSink.OverflowStrategy.BUFFER);
    }

    private static void drainLines(
            StringBuilder buffer,
            FluxSink<String> sink,
            AtomicBoolean emittedSseData) {
        int newlineIndex;
        while ((newlineIndex = indexOfNewline(buffer)) >= 0) {
            String line = buffer.substring(0, newlineIndex);
            buffer.delete(0, newlineIndex + 1);

            line = line.trim();
            if (line.isEmpty() || line.startsWith(":")) {
                continue;
            }
            if (line.startsWith("data:")) {
                String data = line.substring("data:".length()).trim();
                if (!data.isEmpty()) {
                    emittedSseData.set(true);
                    sink.next(data);
                }
            }
        }
    }

    private static void emitNonStreamingCompletion(
            String body,
            ObjectMapper objectMapper,
            FluxSink<String> sink) {
        if (body == null || body.isBlank()) {
            return;
        }

        try {
            JsonNode node = objectMapper.readTree(body);
            JsonNode messageNode = node.path("choices").path(0).path("message").path("content");

            if (messageNode.isTextual()) {
                String text = messageNode.asText("");
                if (!text.isEmpty()) {
                    sink.next(asSseDeltaJson(text));
                }
                return;
            }

            if (messageNode.isArray()) {
                StringBuilder combined = new StringBuilder();
                for (JsonNode part : messageNode) {
                    if ("text".equals(part.path("type").asText())) {
                        combined.append(part.path("text").asText(""));
                    }
                }
                if (!combined.isEmpty()) {
                    sink.next(asSseDeltaJson(combined.toString()));
                }
            }
        } catch (Exception e) {
            log.warn("Failed to parse non-stream completion: {}", e.getMessage());
        }
    }

    private static String asSseDeltaJson(String text) {
        return """
                {"choices":[{"delta":{"content":%s}}]}
                """.formatted(quoteJson(text));
    }

    private static String quoteJson(String text) {
        StringBuilder escaped = new StringBuilder("\"");
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            switch (ch) {
                case '\\' -> escaped.append("\\\\");
                case '"' -> escaped.append("\\\"");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> escaped.append(ch);
            }
        }
        escaped.append('"');
        return escaped.toString();
    }

    private static int indexOfNewline(StringBuilder buffer) {
        for (int i = 0; i < buffer.length(); i++) {
            char ch = buffer.charAt(i);
            if (ch == '\n') {
                return i;
            }
        }
        return -1;
    }
}
