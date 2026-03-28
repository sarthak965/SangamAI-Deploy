package com.sangam.ai.session;

import com.sangam.ai.ai.AiMessage;
import com.sangam.ai.ai.AiProvider;
import com.sangam.ai.environment.EnvironmentMember;
import com.sangam.ai.environment.EnvironmentMemberRepository;
import com.sangam.ai.environment.EnvironmentRepository;
import com.sangam.ai.realtime.CentrifugoService;
import com.sangam.ai.session.dto.*;
import com.sangam.ai.user.User;
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

    // Max depth allowed in the conversation tree
    private static final int MAX_DEPTH = 3;

    private final SessionRepository sessionRepository;
    private final ConversationNodeRepository nodeRepository;
    private final ParagraphRepository paragraphRepository;
    private final EnvironmentRepository environmentRepository;
    private final EnvironmentMemberRepository memberRepository;
    private final AiProvider aiProvider;
    private final CentrifugoService centrifugoService;

    // ----------------------------------------------------------------
    // Session creation
    // ----------------------------------------------------------------

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

    // ----------------------------------------------------------------
    // Root level question (Stage 2)
    // ----------------------------------------------------------------

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

        List<AiMessage> messages = buildRootLevelContext(session, question);
        streamAiResponse(savedNode, messages);

        return savedNode.getId();
    }

    // ----------------------------------------------------------------
    // Paragraph level question (Stage 3) — THE NEW METHOD
    // ----------------------------------------------------------------

    /**
     * Called when a user clicks a paragraph and asks a follow-up.
     * Creates a child ConversationNode under the clicked paragraph.
     *
     * @param parentNodeId  the node whose paragraph was clicked
     * @param paragraphId   the specific paragraph that was clicked
     * @param question      the user's follow-up question
     * @param user          who is asking
     * @return              the new child node's ID (client subscribes to its stream)
     */
    public UUID askOnParagraph(UUID parentNodeId, UUID paragraphId,
                               String question, User user) {

        // Load the parent node
        ConversationNode parentNode = nodeRepository.findById(parentNodeId)
                .orElseThrow(() -> new IllegalArgumentException("Node not found"));

        // Load the specific paragraph that was clicked
        Paragraph targetParagraph = paragraphRepository.findById(paragraphId)
                .orElseThrow(() -> new IllegalArgumentException("Paragraph not found"));

        // Verify the paragraph actually belongs to the parent node
        if (!targetParagraph.getNode().getId().equals(parentNodeId)) {
            throw new IllegalArgumentException("Paragraph does not belong to this node");
        }

        // Enforce depth limit — you cannot go deeper than MAX_DEPTH
        if (parentNode.getDepth() >= MAX_DEPTH) {
            throw new IllegalArgumentException(
                    "Maximum conversation depth (" + MAX_DEPTH + ") reached");
        }

        assertCanInteractWithAi(
                parentNode.getSession().getEnvironment().getId(), user);

        // Create the child node
        ConversationNode childNode = ConversationNode.builder()
                .session(parentNode.getSession())
                .parent(parentNode)               // ← links to parent
                .paragraphId(paragraphId)          // ← which paragraph triggered this
                .depth(parentNode.getDepth() + 1)  // ← one level deeper
                .question(question)
                .askedBy(user)
                .fullContent("")
                .status(ConversationNode.Status.STREAMING)
                .build();

        ConversationNode savedChild = nodeRepository.save(childNode);

        // Notify all session members that a new child node was created
        // Frontend uses this to show the thread under the paragraph
        centrifugoService.publishNodeCreated(
                parentNode.getSession().getId(),
                new java.util.HashMap<>() {{
                    put("type", "child_node_created");
                    put("nodeId", savedChild.getId().toString());
                    put("parentNodeId", parentNodeId.toString());
                    put("paragraphId", paragraphId.toString());
                    put("depth", savedChild.getDepth());
                    put("question", question);
                    put("askedBy", user.getUsername());
                }}
        );

        // Fetch thread history for this paragraph
        // (all previous child nodes that were triggered by this same paragraph)
        List<ConversationNode> threadHistory =
                nodeRepository.findByParentIdOrderByCreatedAtAsc(parentNodeId)
                        .stream()
                        .filter(n -> paragraphId.equals(n.getParagraphId()))
                        .filter(n -> n.getStatus() == ConversationNode.Status.COMPLETE)
                        .filter(n -> !n.getId().equals(savedChild.getId()))
                        .toList();

        // Build paragraph-level context and stream
        List<AiMessage> messages = buildParagraphLevelContext(
                parentNode, targetParagraph, threadHistory, question);
        streamAiResponse(savedChild, messages);

        return savedChild.getId();
    }

    // ----------------------------------------------------------------
    // Snapshot — full session tree for new members joining
    // ----------------------------------------------------------------

    /**
     * Returns the complete conversation tree for a session.
     * Called when a new member opens the session — they need the full
     * history before subscribing to live Centrifugo updates.
     */
    public SessionSnapshotDto getSnapshot(UUID sessionId, User user) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        // Verify the user is a member of this environment
        if (!memberRepository.existsByEnvironmentIdAndUserId(
                session.getEnvironment().getId(), user.getId())) {
            throw new SecurityException("You are not a member of this environment");
        }

        // Fetch all nodes for this session
        List<ConversationNode> allNodes =
                nodeRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);

        // Build root nodes (depth=0) with their full subtrees
        List<ConversationNodeDto> rootNodes = allNodes.stream()
                .filter(n -> n.getDepth() == 0)
                .map(n -> buildNodeDto(n, allNodes))
                .toList();

        return new SessionSnapshotDto(
                session.getId(),
                session.getTitle(),
                session.getStatus().name(),
                rootNodes
        );
    }

    /**
     * Recursively builds a ConversationNodeDto with its paragraphs and children.
     * allNodes is passed in so we don't hit the DB on every recursive call.
     */
    private ConversationNodeDto buildNodeDto(
            ConversationNode node, List<ConversationNode> allNodes) {

        // Get paragraphs for this node
        List<Paragraph> paragraphs =
                paragraphRepository.findByNodeIdOrderByIndex(node.getId());

        // Get direct children of this node from the already-fetched list
        List<ConversationNode> children = allNodes.stream()
                .filter(n -> node.getId().equals(
                        n.getParent() != null ? n.getParent().getId() : null))
                .toList();

        // For each paragraph, count how many child nodes it spawned
        List<ParagraphDto> paragraphDtos = paragraphs.stream()
                .map(p -> {
                    int childCount = (int) children.stream()
                            .filter(c -> p.getId().equals(c.getParagraphId()))
                            .count();
                    return ParagraphDto.from(p, childCount);
                })
                .toList();

        // Recursively build child DTOs
        List<ConversationNodeDto> childDtos = children.stream()
                .map(c -> buildNodeDto(c, allNodes))
                .toList();

        return ConversationNodeDto.from(node, paragraphDtos, childDtos);
    }

    // ----------------------------------------------------------------
    // Context assembly
    // ----------------------------------------------------------------

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

    private List<AiMessage> buildParagraphLevelContext(
            ConversationNode rootNode,
            Paragraph targetParagraph,
            List<ConversationNode> threadHistory,
            String newQuestion) {

        List<AiMessage> messages = new ArrayList<>();

        messages.add(AiMessage.system(String.format("""
                You are a collaborative AI assistant in SangamAI.
                
                Here is the full AI response that was given in this session:
                --- BEGIN SESSION CONTEXT ---
                %s
                --- END SESSION CONTEXT ---
                
                A user is asking a follow-up question specifically about
                this paragraph from that response:
                --- BEGIN PARAGRAPH ---
                %s
                --- END PARAGRAPH ---
                
                Answer the user's question in the context of that paragraph.
                Be focused and concise. Use natural paragraph breaks.
                """,
                rootNode.getFullContent(),
                targetParagraph.getContent()
        )));

        // Add thread history (last 10 exchanges in this paragraph's thread)
        int start = Math.max(0, threadHistory.size() - 10);
        for (ConversationNode past : threadHistory.subList(start, threadHistory.size())) {
            if (past.getQuestion() != null) {
                messages.add(AiMessage.user(past.getQuestion()));
            }
            if (past.getFullContent() != null && !past.getFullContent().isBlank()) {
                messages.add(AiMessage.assistant(past.getFullContent()));
            }
        }

        messages.add(AiMessage.user(newQuestion));
        return messages;
    }

    // ----------------------------------------------------------------
    // Streaming (shared by root and child nodes)
    // ----------------------------------------------------------------

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
                    log.error("AI streaming error for node {}: {}",
                            node.getId(), e.getMessage());
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
        centrifugoService.publishParagraphReady(
                node.getId(), saved.getId(), index, content);
        log.info("Saved paragraph {} for node {}", index, node.getId());
    }

    private boolean isParagraphBoundary(String text) {
        return text.contains("\n\n") || text.matches("(?s).*\n#{1,6} .*");
    }

    // ----------------------------------------------------------------
    // Permission check
    // ----------------------------------------------------------------

    private void assertCanInteractWithAi(UUID environmentId, User user) {
        EnvironmentMember member = memberRepository
                .findByEnvironmentIdAndUserId(environmentId, user.getId())
                .orElseThrow(() -> new SecurityException("You are not a member"));

        if (!member.isCanInteractWithAi()) {
            throw new SecurityException(
                    "You don't have permission to interact with AI");
        }
    }
}