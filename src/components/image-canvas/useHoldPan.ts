import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useReactFlow, useStoreApi, type Viewport } from "@xyflow/react";

const HOLD_DELAY = 150;
export const HOLD_MOVE_TOLERANCE = 4;
const interactive = "button, input, textarea, select, a, summary, [contenteditable], .nodrag, .ic-canvas-top, .ic-canvas-bottom, .ic-selection-bar";
type Hold = { pointerId: number; x: number; y: number; element: HTMLElement; viewport?: Viewport; moved: boolean };

/** Take over only a stationary left-button hold; ordinary clicks and drags stay with XYFlow. */
export function useHoldPan(enabled: boolean, onCommit: (viewport: Viewport) => void) {
  const { getViewport, setViewport } = useReactFlow();
  const store = useStoreApi();
  const hold = useRef<Hold | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressClick = useRef(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  const [panning, setPanning] = useState(false);
  const clearPending = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    if (!hold.current?.viewport) hold.current = null;
  };
  const finish = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const current = hold.current;
    hold.current = null;
    if (!current?.viewport) return;
    if (current.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
    setPanning(false);
    suppressClick.current = true;
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { suppressClick.current = false; }, 0);
    if (current.moved) commit.current(current.viewport);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    if (!enabled) finishRef.current();
    // XYFlow's node dragging also listens for compatibility mousemove events on window.
    // Pointer capture alone cannot stop those from moving a node during a hold-pan.
    const blockNodeDrag = (event: MouseEvent) => {
      if (!hold.current?.viewport) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const releasePending = () => { if (!hold.current?.viewport) clearPending(); };
    const cancel = () => finishRef.current();
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener("mousemove", blockNodeDrag, true);
    window.addEventListener("pointerup", releasePending, true);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(timer.current);
      clearTimeout(clickTimer.current);
      finishRef.current();
      window.removeEventListener("mousemove", blockNodeDrag, true);
      window.removeEventListener("pointerup", releasePending, true);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled]);

  return {
    panning,
    onPointerDownCapture(event: ReactPointerEvent<HTMLElement>) {
      if (!enabled || event.pointerType !== "mouse" || event.button !== 0 || !event.isPrimary || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!(event.target instanceof Element) || !event.target.closest(".react-flow") || event.target.closest(interactive)) return;
      clearPending();
      suppressClick.current = false;
      const current: Hold = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, element: event.currentTarget, moved: false };
      hold.current = current;
      timer.current = setTimeout(() => {
        if (hold.current !== current || !current.element.isConnected) return;
        current.viewport = getViewport();
        current.element.setPointerCapture(current.pointerId);
        store.setState({ userSelectionActive: false, userSelectionRect: null });
        setPanning(true);
      }, HOLD_DELAY);
    },
    onPointerMoveCapture(event: ReactPointerEvent<HTMLElement>) {
      const current = hold.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (!current.viewport) {
        if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > HOLD_MOVE_TOLERANCE) clearPending();
        return;
      }
      event.preventDefault(); event.stopPropagation();
      const dx = event.clientX - current.x, dy = event.clientY - current.y;
      current.viewport = { ...current.viewport, x: current.viewport.x + dx, y: current.viewport.y + dy };
      current.x = event.clientX; current.y = event.clientY;
      current.moved ||= dx !== 0 || dy !== 0;
      void setViewport(current.viewport);
    },
    onPointerUpCapture(event: ReactPointerEvent<HTMLElement>) {
      if (hold.current?.pointerId !== event.pointerId) return;
      if (hold.current.viewport) { event.preventDefault(); event.stopPropagation(); }
      finish();
    },
    onPointerCancelCapture(event: ReactPointerEvent<HTMLElement>) {
      if (hold.current?.pointerId === event.pointerId) finish();
    },
    onLostPointerCapture(event: ReactPointerEvent<HTMLElement>) {
      // Taking capture from the pane also fires this event on the pane itself.
      if (event.target === event.currentTarget && hold.current?.pointerId === event.pointerId) finish();
    },
    onClickCapture(event: ReactMouseEvent<HTMLElement>) {
      if (!suppressClick.current) return;
      event.preventDefault(); event.stopPropagation(); suppressClick.current = false;
    },
  };
}
