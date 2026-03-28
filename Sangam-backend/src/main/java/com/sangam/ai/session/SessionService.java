package com.sangam.ai.session;

import com.sangam.ai.ai.AiMessage;
import com.sangam.ai.ai.AiProvider;
import com.sangam.ai.environment.EnvironmentMember;
import com.sangam.ai.environment.EnvironmentMemberRepository;
import com.sangam.ai.realtime.CentrifugoService;
import com.sangam.ai.user.User;
import com.sangam.ai.environment.EnvironmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SessionService {

    private final SessionRepository sessionRepository;
    private final ConversationNodeRepository nodeRepository;
    private final ParagraphRepository paragraphRepository;
    private final EnvironmentRepository environmentRepository;
    private final EnvironmentMemberRepository memberRepository;
    private final AiProvider aiProvider;
    private final CentrifugoService centrifugoService;

    @Transactional
    public Session createSession(UUID environmentId, String title, User user) {
        var environment = environmentRepository.findById(environmentId)
                .orElseThrow(() -> new IllegalArgumentException("Environment not found"));

        assertCanInteractWithAi(environmentId, user);

        Session session = Session.builder()
                .environment(environment)
                .createdBy(user)
                .title(title)
                .status(Session.Status.OPEN)
                .build();

        return sessionRepository.save(session);
    }

    /**
     * The core method of Stage 2.
     * Receives a question, creates a ConversationNode, streams the
     * AI response, publishes each token to Centrifugo, detects
     * paragraph boundaries, and saves paragraphs progressively.
     *
     * Notice this method is NOT @Transactional — the streaming
     * happens over several seconds and you don't want a database
     * transaction held open that entire time.
     */
    public UUID ask(UUID sessionId, String question, User user) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        assertCanInteractWithAi(session.getEnvironment().getId(), user);

        ConversationNode node = ConversationNode.builder()
                .session(session)
                .parent(null)
                .depth(0)
                .question(question)
                .askedBy(user)
                .fullContent("")
                .status(ConversationNode.Status.STREAMING)
                .build();

        ConversationNode savedNode = nodeRepository.save(node);

        // Build full context THEN stream
        List<AiMessage> messages = buildRootLevelContext(session, question);
        streamAiResponse(savedNode, messages);

        return savedNode.getId();
    }
    private List<AiMessage> buildRootLevelContext(Session session, String newQuestion) {
        List<AiMessage> messages = new ArrayList<>();

        messages.add(AiMessage.system("""
            You are a collaborative AI assistant in SangamAI, a platform
            where teams have shared AI conversations together in real time.
            
            Give clear, thoughtful responses. Use natural paragraph breaks
            between distinct ideas. Do not use bullet points or headers
            unless specifically asked.
            """));

        List<ConversationNode> history = nodeRepository
                .findBySessionIdOrderByCreatedAtAsc(session.getId())
                .stream()
                .filter(n -> n.getStatus() == ConversationNode.Status.COMPLETE)
                .filter(n -> n.getDepth() == 0)
                .toList();

        int start = Math.max(0, history.size() - 10);
        for (ConversationNode past : history.subList(start, history.size())) {
            if (past.getQuestion() != null && !past.getQuestion().isBlank()) {
                messages.add(AiMessage.user(past.getQuestion()));
            }
            if (past.getFullContent() != null && !past.getFullContent().isBlank()) {
                messages.add(AiMessage.assistant(past.getFullContent()));
            }
        }

        messages.add(AiMessage.user(newQuestion));
        return messages;
    }

    private void streamAiResponse(ConversationNode node, List<AiMessage> messages) {
        StringBuilder fullContent = new StringBuilder();
        StringBuilder currentParagraph = new StringBuilder();
        final int[] paragraphIndex = {0};

        aiProvider.streamResponse(messages)
                .doOnNext(chunk -> {
                    fullContent.append(chunk);
                    currentParagraph.append(chunk);
                    centrifugoService.publishTokenChunk(node.getId(), chunk);

                    if (isParagraphBoundary(currentParagraph.toString())) {
                        String paraContent = currentParagraph.toString().trim();
                        if (!paraContent.isEmpty()) {
                            saveParagraph(node, paragraphIndex[0], paraContent);
                            paragraphIndex[0]++;
                        }
                        currentParagraph.setLength(0);
                    }
                })
                .doOnComplete(() -> {
                    String remaining = currentParagraph.toString().trim();
                    if (!remaining.isEmpty()) {
                        saveParagraph(node, paragraphIndex[0], remaining);
                    }
                    node.setFullContent(fullContent.toString());
                    node.setStatus(ConversationNode.Status.COMPLETE);
                    nodeRepository.save(node);
                    centrifugoService.publishStreamComplete(node.getId());
                    log.info("Stream complete for node {}", node.getId());
                })
                .doOnError(e -> {
                    log.error("AI streaming error for node {}: {}", node.getId(), e.getMessage());
                    node.setFullContent(fullContent.toString());
                    node.setStatus(ConversationNode.Status.COMPLETE);
                    nodeRepository.save(node);
                    centrifugoService.publishStreamComplete(node.getId());
                })
                .subscribe();
    }

    private void saveParagraph(ConversationNode node, int index, String content) {
        Paragraph paragraph = Paragraph.builder()
                .node(node)
                .index(index)
                .content(content)
                .build();
        Paragraph saved = paragraphRepository.save(paragraph);

        // Notify all clients that this paragraph is ready and interactive
        centrifugoService.publishParagraphReady(
                node.getId(), saved.getId(), index, content);

        log.info("Saved paragraph {} for node {}", index, node.getId());
    }

    private boolean isParagraphBoundary(String text) {
        // A paragraph ends when we see a double newline
        // or a markdown heading
        return text.contains("\n\n") || text.matches("(?s).*\n#{1,6} .*");
    }

    private void assertCanInteractWithAi(UUID environmentId, User user) {
        EnvironmentMember member = memberRepository
                .findByEnvironmentIdAndUserId(environmentId, user.getId())
                .orElseThrow(() -> new SecurityException("You are not a member"));

        if (!member.isCanInteractWithAi()) {
            throw new SecurityException("You don't have permission to interact with AI");
        }
    }
}