import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { ProjectResponse, SoloChatSummaryResponse } from "../types";

type DialogState =
  | { type: "rename"; value: string }
  | { type: "delete" }
  | { type: "move"; value: string }
  | null;

export default function ChatOverflowMenu({
  token,
  chat,
  projects,
  onChanged,
  onDeleted,
}: {
  token: string;
  chat: SoloChatSummaryResponse;
  projects: ProjectResponse[];
  onChanged: () => Promise<void>;
  onDeleted?: (chatId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await onChanged();
      setOpen(false);
      setDialog(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error occurred");
    } finally {
      setBusy(false);
    }
  };

  const closeDialog = () => {
    if (busy) {
      return;
    }
    setDialog(null);
    setError(null);
  };

  const openDialog = (nextDialog: Exclude<DialogState, null>) => {
    setDialog(nextDialog);
    setError(null);
  };

  return (
    <>
      <div className="chat-overflow" ref={menuRef}>
        <button
          className="chat-overflow-trigger"
          type="button"
          aria-label="Chat actions"
          aria-expanded={open}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((current) => !current);
          }}
        >
          <span aria-hidden="true">...</span>
        </button>

        {open && (
          <div className="chat-overflow-menu">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void runAction(async () => {
                  await api.updateSoloChat(token, chat.id, { pinned: !chat.pinned });
                });
              }}
            >
              <PinIcon />
              <span>{chat.pinned ? "Unpin chat" : "Pin chat"}</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openDialog({ type: "rename", value: chat.title });
              }}
            >
              <RenameIcon />
              <span>Rename</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openDialog({ type: "move", value: chat.projectId ?? "" });
              }}
            >
              <ProjectIcon />
              <span>{chat.projectId ? "Move to project" : "Add to project"}</span>
            </button>
            <button
              type="button"
              className="danger"
              onClick={(event) => {
                event.stopPropagation();
                openDialog({ type: "delete" });
              }}
            >
              <DeleteIcon />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>

      {dialog?.type === "rename" && (
        <ActionDialog
          title="Rename chat"
          confirmLabel="Save"
          busy={busy}
          error={error}
          onCancel={closeDialog}
          onConfirm={() =>
            void runAction(async () => {
              await api.updateSoloChat(token, chat.id, { title: dialog.value.trim() });
            })
          }
        >
          <input
            className="dialog-input"
            value={dialog.value}
            onChange={(event) => setDialog({ type: "rename", value: event.target.value })}
            autoFocus
          />
        </ActionDialog>
      )}

      {dialog?.type === "delete" && (
        <ActionDialog
          title="Delete chat?"
          confirmLabel="Delete"
          busy={busy}
          danger
          error={error}
          onCancel={closeDialog}
          onConfirm={() =>
            void runAction(async () => {
              await api.deleteSoloChat(token, chat.id);
              onDeleted?.(chat.id);
            })
          }
        >
          <p>
            This will delete <strong>{chat.title}</strong>.
          </p>
        </ActionDialog>
      )}

      {dialog?.type === "move" && (
        <ActionDialog
          title={chat.projectId ? "Move chat to project" : "Add chat to project"}
          confirmLabel="Save"
          busy={busy}
          error={error}
          onCancel={closeDialog}
          onConfirm={() =>
            void runAction(async () => {
              await api.updateSoloChat(token, chat.id, {
                projectId: dialog.value || null,
              });
            })
          }
        >
          <select
            className="dialog-select"
            value={dialog.value}
            onChange={(event) => setDialog({ type: "move", value: event.target.value })}
            autoFocus
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </ActionDialog>
      )}
    </>
  );
}

function PinIcon() {
  return (
    <svg className="chat-overflow-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M10.4 1.8 14 5.4l-1.5 1.1-.6 3.4-1 1-2.8-2.8-4.4 4.4-.7-.7 4.4-4.4L4.6 4.6l1-1 3.4-.6 1.4-1.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg className="chat-overflow-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.2 11.8 11.6 3.4a1.4 1.4 0 0 1 2 2l-8.4 8.4-2.8.8.8-2.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg className="chat-overflow-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2.5 4.2h4l1.1 1.2h6v6.4a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5.2a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="chat-overflow-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.8 4.3h8.4m-7.3 0 .5 8h4.2l.5-8m-4.6 0V2.8h2.9v1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActionDialog({
  title,
  confirmLabel,
  busy,
  danger = false,
  error,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  confirmLabel: string;
  busy: boolean;
  danger?: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  children: ReactNode;
}) {
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog-card" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-head">
          <h3>{title}</h3>
        </div>
        <div className="dialog-body">{children}</div>
        {error && <div className="dialog-error">{error}</div>}
        <div className="dialog-actions">
          <button className="btn btn-secondary" type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? "dialog-danger" : "btn-primary"}`}
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
