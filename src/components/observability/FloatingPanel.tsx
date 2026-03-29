import { useCallback, useRef, type ReactNode } from "react";

interface FloatingPanelProps {
  title: string;
  defaultX: number;
  defaultY: number;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

export function FloatingPanel({
  title,
  defaultX,
  defaultY,
  onClose,
  children,
  width,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: defaultX, y: defaultY });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );

  const applyPosition = useCallback(() => {
    if (panelRef.current) {
      panelRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
    }
  }, []);

  const onHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: posRef.current.x,
        origY: posRef.current.y,
      };
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        posRef.current.x = dragRef.current.origX + (ev.clientX - dragRef.current.startX);
        posRef.current.y = dragRef.current.origY + (ev.clientY - dragRef.current.startY);
        applyPosition();
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [applyPosition],
  );

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={panelRef}
      className="floating-panel"
      style={{
        transform: `translate(${defaultX}px, ${defaultY}px)`,
        width: width ?? 280,
      }}
      onMouseDown={stopPropagation}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="floating-panel-header" onMouseDown={onHeaderMouseDown}>
        <span className="floating-panel-title">{title}</span>
        <button className="floating-panel-close" onClick={onClose}>
          &times;
        </button>
      </div>
      <div className="floating-panel-body">{children}</div>
    </div>
  );
}
