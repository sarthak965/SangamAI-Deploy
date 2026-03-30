import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { realtimeManager } from "../lib/realtime";
import type {
  ConversationNodeDto,
  CurrentUser,
  EnvironmentEventMemberUpdated,
  EnvironmentResponse,
  MemberResponse,
  NodeStreamEvent,
  ParagraphDto,
  SessionEventChildNodeCreated,
  SessionEventRootNodeCreated,
  SessionListItem,
  SessionSnapshotDto,
  StreamingNodeState,
} from "../types";

/* ── max depth for paragraph drill-down ────────────────────── */
const MAX_THREAD_DEPTH = 3;

export default function SessionPage({
  token,
  me,
}: {
  token: string;
  me: CurrentUser;
}) {
  const navigate = useNavigate();
  const { environmentId, sessionId } = useParams();
  const [environment, setEnvironment] = useState<EnvironmentResponse | null>(null);
  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [snapshot, setSnapshot] = useState<SessionSnapshotDto | null>(null);
  const [streamingNodes, setStreamingNodes] = useState<Record<string, StreamingNodeState>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rootQuestion, setRootQuestion] = useState("");

  /* thread panel state */
  const [threadOpen, setThreadOpen] = useState(false);
  const [threadParagraph, setThreadParagraph] = useState<{
    nodeId: string;
    paragraph: ParagraphDto;
    parentNode: ConversationNodeDto;
  } | null>(null);

  const sessionUnsub = useRef<(() => void) | null>(null);
  const envUnsub = useRef<(() => void) | null>(null);
  const nodeUnsubs = useRef<Record<string, () => void>>({});
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const hasScrolledToBottom = useRef(false);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.sessionId === sessionId) ?? null,
    [sessions, sessionId],
  );

  const currentMember = members.find((m) => m.username === me.username) ?? null;
  const canAskRoot =
    currentMember?.role === "OWNER" || currentMember?.role === "CO_HOST";
  const canAskParagraph =
    canAskRoot || Boolean(currentMember?.canInteractWithAi);

  /* ── data loading ──────────────────────────────────────── */
  const loadAll = async () => {
    if (!environmentId || !sessionId) return;
    const [envs, mems, sess, snap] = await Promise.all([
      api.listEnvironments(token),
      api.getMembers(token, environmentId),
      api.listSessions(token, environmentId),
      api.getSnapshot(token, sessionId),
    ]);
    setEnvironment(envs.find((e) => e.id === environmentId) ?? null);
    setMembers(mems);
    setSessions(sess);
    setSnapshot(snap);
  };

  const attachNode = async (
    nodeId: string,
    meta?: Partial<StreamingNodeState>,
  ) => {
    if (nodeUnsubs.current[nodeId]) return;

    setStreamingNodes((s) => ({
      ...s,
      [nodeId]: { nodeId, content: "", paragraphs: [], done: false, ...meta },
    }));

    const unsub = await realtimeManager.subscribe<NodeStreamEvent>(
      token,
      `node:${nodeId}:stream`,
      (data) => {
        setStreamingNodes((s) => {
          const cur = s[nodeId] ?? {
            nodeId,
            content: "",
            paragraphs: [],
            done: false,
            ...meta,
          };
          if (data.type === "chunk")
            return { ...s, [nodeId]: { ...cur, content: cur.content + data.content } };
          if (data.type === "paragraph_ready")
            return {
              ...s,
              [nodeId]: {
                ...cur,
                paragraphs: [
                  ...cur.paragraphs.filter((p) => p.id !== data.paragraphId),
                  { id: data.paragraphId, index: data.index, content: data.content },
                ].sort((a, b) => a.index - b.index),
              },
            };
          if (data.type === "done") {
            void loadAll().catch(() => {});
            return { ...s, [nodeId]: { ...cur, done: true } };
          }
          return s;
        });
      },
    );

    nodeUnsubs.current[nodeId] = () => {
      unsub();
      delete nodeUnsubs.current[nodeId];
    };
  };

  const attachStreamingSnapshotNodes = async (roots: ConversationNodeDto[]) => {
    const activeNodes = collectStreamingNodes(roots);
    await Promise.all(
      activeNodes.map((node) =>
        attachNode(node.id, {
          question: node.question ?? undefined,
          parentNodeId: node.parentId ?? undefined,
          paragraphId: node.paragraphId ?? undefined,
        }),
      ),
    );
  };

  /* Reset scroll flag when navigating to a different session */
  useEffect(() => {
    hasScrolledToBottom.current = false;
    loadAll().catch((e: Error) => setError(e.message));
  }, [environmentId, sessionId, token]);

  useEffect(() => {
    if (!snapshot) return;

    attachStreamingSnapshotNodes(snapshot.rootNodes).catch((e: Error) =>
      setError(e.message),
    );

    /* Scroll to bottom on first snapshot load so user sees latest messages */
    if (!hasScrolledToBottom.current && snapshot.rootNodes.length > 0) {
      hasScrolledToBottom.current = true;
      requestAnimationFrame(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "instant" });
      });
    }
  }, [snapshot]);

  /**
   * Polling fallback: while any node is still streaming, re-fetch the
   * snapshot every 2s. This catches chunks missed due to the subscription
   * race condition (late subscribe, network delay, etc.).
   */
  useEffect(() => {
    const hasActiveStreams = Object.values(streamingNodes).some((n) => !n.done);
    if (!hasActiveStreams || !sessionId) return;

    const interval = setInterval(() => {
      void loadAll().catch(() => {});
    }, 2000);

    return () => clearInterval(interval);
  }, [streamingNodes, sessionId, token]);

  /* session events */
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    sessionUnsub.current?.();

    realtimeManager
      .subscribe<SessionEventChildNodeCreated | SessionEventRootNodeCreated>(
        token,
        `session:${sessionId}:events`,
        (data) => {
          if (!active) return;
          void attachNode(data.nodeId, {
            question: data.question,
            parentNodeId: data.type === "child_node_created" ? data.parentNodeId : undefined,
            paragraphId: data.type === "child_node_created" ? data.paragraphId : undefined,
          });
          void loadAll().catch((e: Error) => setError(e.message));
        },
      )
      .then((unsub) => {
        if (active) sessionUnsub.current = unsub;
        else unsub();
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      active = false;
      sessionUnsub.current?.();
      sessionUnsub.current = null;
    };
  }, [sessionId, token]);

  /* environment events */
  useEffect(() => {
    if (!environmentId) return;
    let active = true;
    envUnsub.current?.();

    realtimeManager
      .subscribe<EnvironmentEventMemberUpdated>(
        token,
        `env:${environmentId}`,
        () => {
          if (active) void loadAll().catch((e: Error) => setError(e.message));
        },
      )
      .then((unsub) => {
        if (active) envUnsub.current = unsub;
        else unsub();
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      active = false;
      envUnsub.current?.();
      envUnsub.current = null;
    };
  }, [environmentId, token]);

  /* cleanup */
  useEffect(() => {
    return () => {
      sessionUnsub.current?.();
      envUnsub.current?.();
      Object.values(nodeUnsubs.current).forEach((fn) => fn());
    };
  }, []);

  const withBusy = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyKey(null);
    }
  };

  /* ── open thread panel ─────────────────────────────────── */
  const openThread = (nodeId: string, paragraph: ParagraphDto, parentNode: ConversationNodeDto) => {
    setThreadParagraph({ nodeId, paragraph, parentNode });
    setThreadOpen(true);
  };

  /* ── render ────────────────────────────────────────────── */
  return (
    <div className="session-page">
      {/* Header */}
      <div className="session-header">
        <div>
          <h1>{selectedSession?.title ?? "Session"}</h1>
          {environment && (
            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {environment.name}
            </span>
          )}
        </div>
        <div className="session-header-meta">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/app/environments/${environmentId}`)}
          >
            ← Back to environment
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Chat messages */}
      <div className="chat-container">
        {snapshot?.rootNodes.length === 0 &&
          Object.keys(streamingNodes).length === 0 && (
            <div className="empty-state">
              <h4>Start the conversation</h4>
              <p>Ask the shared AI something the room should explore together.</p>
            </div>
          )}

        {snapshot?.rootNodes.map((node) => (
          <ChatNode
            key={node.id}
            node={node}
            depth={0}
            streamingNodes={streamingNodes}
            onOpenThread={openThread}
          />
        ))}

        {/* Render streaming nodes that are NOT yet in the snapshot */}
        {Object.values(streamingNodes)
          .filter((sn) => {
            if (sn.done) return false;
            /* skip if this node already exists in the snapshot tree */
            const existsInSnapshot = snapshot?.rootNodes.some(
              (root) => findNodeInTree(root, sn.nodeId),
            );
            return !existsInSnapshot;
          })
          .map((sn) => (
            <StreamingChatMessage key={sn.nodeId} node={sn} />
          ))}

        {/* Scroll anchor — always at the bottom of chat */}
        <div ref={chatBottomRef} />
      </div>

      {/* Composer */}
      <div className="chat-composer">
        <form
          className="composer-box"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rootQuestion.trim() || !sessionId) return;
            void withBusy("ask-root", async () => {
              const q = rootQuestion;
              setRootQuestion("");
              const res = await api.askRoot(token, sessionId, q);
              await attachNode(res.nodeId, { question: q });
            });
          }}
        >
          <textarea
            value={rootQuestion}
            onChange={(e) => setRootQuestion(e.target.value)}
            placeholder={
              canAskRoot
                ? "Ask the shared AI something..."
                : "Only hosts can ask root questions"
            }
            disabled={!canAskRoot}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            className="btn btn-primary"
            disabled={busyKey === "ask-root" || !canAskRoot}
            type="submit"
          >
            ↑
          </button>
        </form>
        {!canAskRoot && (
          <p className="composer-hint">
            Only hosts and co-hosts can ask root questions.
          </p>
        )}
      </div>

      {/* Thread panel */}
      <ThreadPanel
        open={threadOpen}
        paragraph={threadParagraph}
        token={token}
        canAsk={canAskParagraph}
        busyKey={busyKey}
        onClose={() => {
          setThreadOpen(false);
          setThreadParagraph(null);
        }}
        onAsk={(nodeId, paragraphId, question) =>
          withBusy(`para-${paragraphId}`, async () => {
            const res = await api.askOnParagraph(token, nodeId, paragraphId, question);
            await attachNode(res.nodeId, {
              parentNodeId: nodeId,
              paragraphId,
              question,
            });
          })
        }
      />
    </div>
  );
}

/* ── helper: find a node anywhere in the tree ──────────────── */
function findNodeInTree(root: ConversationNodeDto, nodeId: string): boolean {
  if (root.id === nodeId) return true;
  return root.children.some((child) => findNodeInTree(child, nodeId));
}

function collectStreamingNodes(nodes: ConversationNodeDto[]): ConversationNodeDto[] {
  const result: ConversationNodeDto[] = [];

  for (const node of nodes) {
    if (node.status === "STREAMING") {
      result.push(node);
    }
    result.push(...collectStreamingNodes(node.children));
  }

  return result;
}

/* ── Streaming chat message (for nodes not yet in snapshot) ── */
function StreamingChatMessage({ node }: { node: StreamingNodeState }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  /* auto-scroll as content streams in */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [node.content]);

  return (
    <>
      {/* User question */}
      {node.question && (
        <div className="chat-message user-turn">
          <div className="chat-message-header">
            <div className="chat-avatar user">?</div>
            <span className="chat-sender">You</span>
          </div>
          <div className="chat-question">{node.question}</div>
        </div>
      )}

      {/* AI response streaming live */}
      <div className="chat-message assistant-turn is-streaming">
        <div className="chat-message-header">
          <div className="chat-avatar ai">AI</div>
          <span className="chat-sender">SangamAI</span>
          <span className="streaming-badge">● Streaming</span>
        </div>
        <div className="ai-response">
          {node.content
            ? node.content
                .split("\n\n")
                .filter(Boolean)
                .map((text, i) => (
                  <div key={i} className="ai-paragraph">
                    <p>{text}</p>
                  </div>
                ))
            : (
              <div className="ai-paragraph">
                <p className="streaming-placeholder">Thinking...</p>
              </div>
            )}
        </div>
        <div ref={bottomRef} />
      </div>
    </>
  );
}

/* ── Chat node (recursive, for snapshot nodes) ─────────────── */
function ChatNode({
  node,
  depth,
  streamingNodes,
  onOpenThread,
}: {
  node: ConversationNodeDto;
  depth: number;
  streamingNodes: Record<string, StreamingNodeState>;
  onOpenThread: (nodeId: string, paragraph: ParagraphDto, parentNode: ConversationNodeDto) => void;
}) {
  const liveNode = streamingNodes[node.id];
  const isStillStreaming =
    (liveNode && !liveNode.done) || node.status === "STREAMING";

  /* Prefer live streaming content over snapshot (snapshot fullContent is
     empty while status=STREAMING). Fall back to snapshot when complete. */
  const content = liveNode?.content || node.fullContent || "";
  const hasFinalParagraphs = node.paragraphs.length > 0 && !isStillStreaming;

  const bottomRef = useRef<HTMLDivElement>(null);

  /* auto-scroll while streaming */
  useEffect(() => {
    if (isStillStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isStillStreaming, liveNode?.content]);

  return (
    <>
      {/* User question */}
      {node.question && (
        <div className="chat-message user-turn">
          <div className="chat-message-header">
            <div className="chat-avatar user">
              {(node.askedByUsername ?? "?").charAt(0).toUpperCase()}
            </div>
            <span className="chat-sender">
              {node.askedByUsername ? `@${node.askedByUsername}` : "Room"}
            </span>
          </div>
          <div className="chat-question">{node.question}</div>
        </div>
      )}

      {/* AI response */}
      {(content || isStillStreaming) && (
        <div
          className={`chat-message assistant-turn ${isStillStreaming ? "is-streaming" : ""}`}
        >
          <div className="chat-message-header">
            <div className="chat-avatar ai">AI</div>
            <span className="chat-sender">SangamAI</span>
            {isStillStreaming && (
              <span className="streaming-badge">● Streaming</span>
            )}
          </div>
          <div className="ai-response">
            {hasFinalParagraphs
              ? /* Final paragraphs from snapshot — clickable */
                node.paragraphs.map((p) => (
                  <div
                    key={p.id}
                    className="ai-paragraph"
                    onClick={() => {
                      if (node.depth < MAX_THREAD_DEPTH) {
                        onOpenThread(node.id, p, node);
                      }
                    }}
                  >
                    <p>{p.content}</p>
                    {node.depth < MAX_THREAD_DEPTH && (
                      <div className="thread-indicator">
                        💬 {p.childNodeCount > 0 ? `${p.childNodeCount} threads` : "Discuss this"}
                      </div>
                    )}
                  </div>
                ))
              : /* Still streaming or raw content — show as flowing text */
                (content || "Thinking...").split("\n\n").filter(Boolean).map((text, i) => (
                  <div key={i} className="ai-paragraph">
                    <p>{text}{isStillStreaming && i === (content || "").split("\n\n").filter(Boolean).length - 1 ? "▊" : ""}</p>
                  </div>
                ))}
          </div>
          <div ref={bottomRef} />
        </div>
      )}

      {/* Render children recursively */}
      {node.children.map((child) => (
        <ChatNode
          key={child.id}
          node={child}
          depth={depth + 1}
          streamingNodes={streamingNodes}
          onOpenThread={onOpenThread}
        />
      ))}
    </>
  );
}

/* ── Thread panel (slide-in) ───────────────────────────────── */
function ThreadPanel({
  open,
  paragraph,
  token,
  canAsk,
  busyKey,
  onClose,
  onAsk,
}: {
  open: boolean;
  paragraph: {
    nodeId: string;
    paragraph: ParagraphDto;
    parentNode: ConversationNodeDto;
  } | null;
  token: string;
  canAsk: boolean;
  busyKey: string | null;
  onClose: () => void;
  onAsk: (nodeId: string, paragraphId: string, question: string) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");

  /* find child nodes for this paragraph from the parent */
  const childNodes =
    paragraph?.parentNode.children.filter(
      (c) => c.paragraphId === paragraph.paragraph.id,
    ) ?? [];

  return (
    <>
      {/* backdrop */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.15)",
            zIndex: 199,
          }}
          onClick={onClose}
        />
      )}

      <div className={`thread-panel ${open ? "open" : ""}`}>
        <div className="thread-panel-header">
          <h3>Paragraph Thread</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="thread-panel-content">
          {/* The paragraph text */}
          {paragraph && (
            <div
              style={{
                padding: "1rem",
                background: "var(--bg-secondary)",
                borderRadius: "var(--radius-md)",
                marginBottom: "1.5rem",
                fontSize: "0.95rem",
                lineHeight: 1.7,
                borderLeft: "3px solid var(--accent)",
              }}
            >
              {paragraph.paragraph.content}
            </div>
          )}

          {/* Child questions (show only the question, not AI response) */}
          {childNodes.length === 0 ? (
            <div className="empty-state">
              <p>No discussions yet. Be the first to ask about this paragraph.</p>
            </div>
          ) : (
            childNodes.map((child) => (
              <ChildThreadQuestion key={child.id} node={child} />
            ))
          )}
        </div>

        {/* Composer */}
        {canAsk && paragraph && (
          <div className="thread-panel-composer">
            <form
              className="composer-box"
              onSubmit={(e) => {
                e.preventDefault();
                if (!question.trim()) return;
                void onAsk(
                  paragraph.nodeId,
                  paragraph.paragraph.id,
                  question,
                ).then(() => setQuestion(""));
              }}
            >
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about this paragraph..."
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                className="btn btn-primary"
                disabled={
                  busyKey === `para-${paragraph.paragraph.id}`
                }
                type="submit"
              >
                ↑
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Child thread question (expandable to show AI response) ── */
function ChildThreadQuestion({ node }: { node: ConversationNodeDto }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <div className="thread-question" onClick={() => setExpanded(!expanded)}>
        <div className="asker">
          @{node.askedByUsername ?? "unknown"}
        </div>
        <div className="question-text">{node.question}</div>
      </div>

      {expanded && node.fullContent && (
        <div
          style={{
            padding: "0.75rem 1rem",
            fontSize: "0.9rem",
            lineHeight: 1.7,
            color: "var(--text-secondary)",
            borderLeft: "2px solid var(--border)",
            marginLeft: "0.5rem",
            marginBottom: "0.5rem",
          }}
        >
          {node.paragraphs.length > 0
            ? node.paragraphs.map((p) => (
                <p key={p.id} style={{ marginBottom: "0.75rem" }}>
                  {p.content}
                </p>
              ))
            : node.fullContent}
        </div>
      )}
    </div>
  );
}
