import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function Modal({
  onClose,
  children,
  className = "",
  closeOnBackdrop = true,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
}) {
  useEffect(() => {
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={() => {
        if (closeOnBackdrop) onClose();
      }}
    >
      <div className={`modal-card ${className}`} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
