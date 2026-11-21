import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveRouteScrollOwner,
  shouldResetRouteScroll,
} from "../src/components/route-scroll-manager.js";

const route = (pathname, { search = "", hash = "" } = {}) => ({ pathname, search, hash });

test("route scroll policy resets different PUSH and REPLACE destinations only", () => {
  assert.equal(shouldResetRouteScroll(route("/dashboard"), route("/review"), "PUSH"), true);
  assert.equal(shouldResetRouteScroll(route("/dashboard"), route("/topics"), "REPLACE"), true);
  assert.equal(shouldResetRouteScroll(route("/review"), route("/review"), "PUSH"), false);
  assert.equal(shouldResetRouteScroll(route("/review"), route("/review", { search: "?filter=due" }), "PUSH"), false);
  assert.equal(shouldResetRouteScroll(route("/review", { search: "?filter=due" }), route("/review", { search: "?filter=all" }), "REPLACE"), false);
  assert.equal(shouldResetRouteScroll(route("/review", { search: "?page=1" }), route("/review", { search: "?page=1" }), "REPLACE"), false);
});

test("route scroll policy preserves POP restoration and intentional hashes", () => {
  assert.equal(shouldResetRouteScroll(route("/review"), route("/dashboard"), "POP"), false);
  assert.equal(shouldResetRouteScroll(route("/dashboard"), route("/topics", { hash: "#featured" }), "PUSH"), false);
});

test("scroll owner follows nested overflow before falling back to the document", () => {
  const documentOwner = { scrollTop: 0 };
  const nested = { ownerDocument: { defaultView: { getComputedStyle: () => ({ overflowY: "auto" }) } } };
  const visible = { ownerDocument: { defaultView: { getComputedStyle: () => ({ overflowY: "visible" }) } } };
  assert.equal(resolveRouteScrollOwner(fakeDocument({ main: nested }, documentOwner)), nested);
  assert.equal(resolveRouteScrollOwner(fakeDocument({ focus: nested, main: visible }, documentOwner)), nested);
  assert.equal(resolveRouteScrollOwner(fakeDocument({ main: visible }, documentOwner)), documentOwner);
});

function fakeDocument(elements, scrollingElement) {
  return {
    scrollingElement,
    querySelector(selector) {
      if (selector === ".learning-focus-shell") return elements.focus ?? null;
      if (selector === "main.authenticated-main") return elements.main ?? null;
      return null;
    },
  };
}
