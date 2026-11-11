import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indicator = await readFile(new URL("../src/components/loading-indicator.jsx", import.meta.url), "utf8");
const authLoading = await readFile(new URL("../src/auth/ui/authentication-loading-state.jsx", import.meta.url), "utf8");
const routeGuards = await readFile(new URL("../src/auth/ui/route-guards.jsx", import.meta.url), "utf8");
const discoveryLayout = await readFile(new URL("../src/topics/discovery-route-layout.jsx", import.meta.url), "utf8");

test("LoadingIndicator provides compact and centered accessible pending states", () => {
  assert.match(indicator, /variant = "inline"/);
  assert.match(indicator, /variant === "centered"/);
  assert.match(indicator, /role="status"/);
  assert.match(indicator, /aria-live="polite"/);
  assert.match(indicator, /motion-reduce:animate-none/);
  assert.match(indicator, /bg-sky-50/);
  assert.doesNotMatch(indicator, /(?:indigo|violet|purple)-/);
});

test("authentication bootstrap uses one shared Bright and Clean loading state", () => {
  assert.match(authLoading, /<LoadingIndicator label="Đang kiểm tra phiên đăng nhập…" variant="centered" \/>/);
  assert.match(authLoading, /bg-\[#0877b9\]/);
  assert.doesNotMatch(authLoading, /(?:indigo|violet|purple)-/);
  assert.match(routeGuards, /import \{ AuthenticationLoadingState \} from "\.\/authentication-loading-state\.jsx"/);
  assert.match(discoveryLayout, /import \{ AuthenticationLoadingState \} from "\.\.\/auth\/ui\/authentication-loading-state\.jsx"/);
  assert.doesNotMatch(routeGuards, /function AuthenticationLoadingState/);
  assert.doesNotMatch(discoveryLayout, /Đang kiểm tra phiên đăng nhập/);
});
