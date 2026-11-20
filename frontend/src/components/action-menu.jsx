import { MoreVertical } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ACTION_MENU_OPEN_EVENT = "elvocab:action-menu-open";
const VIEWPORT_MARGIN = 8;
const MENU_GAP = 6;

function getMenuPosition(trigger, popover) {
  const triggerRect = trigger.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const belowTop = triggerRect.bottom + MENU_GAP;
  const aboveTop = triggerRect.top - popoverRect.height - MENU_GAP;
  const opensAbove = belowTop + popoverRect.height > viewportHeight - VIEWPORT_MARGIN
    && aboveTop >= VIEWPORT_MARGIN;
  const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - popoverRect.height - VIEWPORT_MARGIN);
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - popoverRect.width - VIEWPORT_MARGIN);

  return {
    left: Math.min(Math.max(triggerRect.right - popoverRect.width, VIEWPORT_MARGIN), maxLeft),
    placement: opensAbove ? "top" : "bottom",
    top: Math.min(Math.max(opensAbove ? aboveTop : belowTop, VIEWPORT_MARGIN), maxTop),
  };
}

export function ActionMenu({ children, label, registerTrigger }) {
  const menuId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const frameRef = useRef(null);
  const focusedOnOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setPosition(null);
    focusedOnOpenRef.current = false;
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current?.isConnected || !popoverRef.current) {
      closeMenu();
      return;
    }
    setPosition(getMenuPosition(triggerRef.current, popoverRef.current));
  }, [closeMenu]);

  const schedulePositionUpdate = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useEffect(() => {
    const closeOtherMenu = (event) => {
      if (event.detail !== menuId) closeMenu();
    };
    document.addEventListener(ACTION_MENU_OPEN_EVENT, closeOtherMenu);
    return () => document.removeEventListener(ACTION_MENU_OPEN_EVENT, closeOtherMenu);
  }, [closeMenu, menuId]);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (open && position && !focusedOnOpenRef.current) {
      focusedOnOpenRef.current = true;
      popoverRef.current?.querySelector('[role="menuitem"]')?.focus();
    }
  }, [open, position]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (rootRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) return;
      closeMenu();
    };
    const closeEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    window.addEventListener("resize", schedulePositionUpdate);
    window.addEventListener("scroll", schedulePositionUpdate, true);
    window.visualViewport?.addEventListener("resize", schedulePositionUpdate);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
      window.removeEventListener("resize", schedulePositionUpdate);
      window.removeEventListener("scroll", schedulePositionUpdate, true);
      window.visualViewport?.removeEventListener("resize", schedulePositionUpdate);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [closeMenu, open, schedulePositionUpdate]);

  const toggleMenu = () => {
    if (open) {
      closeMenu();
      return;
    }
    setPosition(null);
    focusedOnOpenRef.current = false;
    document.dispatchEvent(new CustomEvent(ACTION_MENU_OPEN_EVENT, { detail: menuId }));
    setOpen(true);
  };

  const popover = open && typeof document !== "undefined" ? createPortal(
    <div
      className="action-menu-popover fixed z-[100] grid min-w-40 overflow-hidden rounded-[0.85rem] border border-[#e0e3ee] bg-white p-1.5 shadow-[0_16px_36px_rgb(30_41_59/14%)] [&_button]:flex [&_button]:min-h-11 [&_button]:cursor-pointer [&_button]:items-center [&_button]:gap-2 [&_button]:whitespace-nowrap [&_button]:rounded-lg [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-[0.7rem] [&_button]:py-2.5 [&_button]:font-[inherit] [&_button]:font-semibold [&_button]:text-slate-700 [&_button]:transition-colors [&_button]:duration-150 [&_button:hover]:bg-slate-100 [&_button:focus-visible]:bg-slate-100 [&_button:focus-visible]:outline-3 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-indigo-200 [&_button.is-danger]:text-red-700 [&_button.is-danger:hover]:bg-rose-50 motion-reduce:[&_button]:transition-none"
      data-placement={position?.placement}
      id={menuId}
      ref={popoverRef}
      role="menu"
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
      onClick={closeMenu}
    >
      {children}
    </div>,
    document.body,
  ) : null;

  return <div className="action-menu relative inline-flex" ref={rootRef}>
    <button ref={(control) => { triggerRef.current = control; registerTrigger?.(control); }} type="button" className="action-menu-trigger inline-grid size-11 min-w-11 cursor-pointer place-items-center rounded-xl border border-[#dbe3ef] bg-white p-0 text-slate-600 transition-[border-color,background-color,color,box-shadow] duration-150 hover:border-[#bfc7e8] hover:bg-[#f5f6ff] hover:text-indigo-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-200 motion-reduce:transition-none [&_svg]:size-[1.15rem]" aria-controls={open ? menuId : undefined} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={toggleMenu}><MoreVertical aria-hidden="true" /></button>
    {popover}
  </div>;
}
