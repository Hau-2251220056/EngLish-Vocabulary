import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const nestedScrollPositions = new Map();

export function RouteScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousRef = useRef(null);

  useLayoutEffect(() => {
    const previous = previousRef.current;
    const owner = resolveRouteScrollOwner(document);
    if (navigationType === "POP") {
      if (!isDocumentScrollOwner(owner, document)) {
        const savedPosition = nestedScrollPositions.get(location.key);
        if (savedPosition !== undefined) writeScrollTop(owner, savedPosition);
      }
    } else if (shouldResetRouteScroll(previous?.location, location, navigationType)) {
      writeScrollTop(owner, 0);
    }

    previousRef.current = { key: location.key, location };
    const capturePosition = () => {
      const currentOwner = resolveRouteScrollOwner(document);
      nestedScrollPositions.set(location.key, readScrollTop(currentOwner));
    };
    capturePosition();
    document.addEventListener("scroll", capturePosition, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", capturePosition, { capture: true });
  }, [location, navigationType]);

  return null;
}

export function shouldResetRouteScroll(previous, next, navigationType) {
  if (!previous || navigationType === "POP") return false;
  if (next.hash) return false;
  return previous.pathname !== next.pathname;
}

export function resolveRouteScrollOwner(documentObject) {
  for (const selector of [".learning-focus-shell", "main.authenticated-main"]) {
    const candidate = documentObject.querySelector(selector);
    if (candidate && isNestedScrollOwner(candidate)) return candidate;
  }
  return documentObject.scrollingElement;
}

function isNestedScrollOwner(element) {
  const overflowY = element.ownerDocument.defaultView.getComputedStyle(element).overflowY;
  return overflowY === "auto" || overflowY === "scroll";
}

function isDocumentScrollOwner(owner, documentObject) {
  return owner === documentObject.scrollingElement;
}

function readScrollTop(owner) {
  return Number.isFinite(owner?.scrollTop) ? owner.scrollTop : 0;
}

function writeScrollTop(owner, top) {
  owner?.scrollTo({ top, left: 0, behavior: "auto" });
}
