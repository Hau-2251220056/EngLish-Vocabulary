export function navigateToLandingSection(event, hash) {
  event.preventDefault();
  const target = document.querySelector(hash);
  if (!target) return false;

  if (window.location.hash === hash) {
    window.history.replaceState(null, "", hash);
  } else {
    window.history.pushState(null, "", hash);
  }

  target.focus({ preventScroll: true });
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  return true;
}
