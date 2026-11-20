import { routes } from "@vercel/config/v1";

function readApiProxyOrigin(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("API_PROXY_TARGET is required for Vercel routing.");
  }

  if (value !== value.trim()) {
    throw new TypeError("API_PROXY_TARGET must not contain surrounding whitespace.");
  }

  let target;
  try {
    target = new URL(value);
  } catch {
    throw new TypeError("API_PROXY_TARGET must be an absolute HTTPS origin.");
  }

  if (target.protocol !== "https:") {
    throw new TypeError("API_PROXY_TARGET must use HTTPS.");
  }

  if (target.username || target.password) {
    throw new TypeError("API_PROXY_TARGET must not contain credentials.");
  }

  if (target.search || value.includes("?")) {
    throw new TypeError("API_PROXY_TARGET must not contain a query string.");
  }

  if (target.hash || value.includes("#")) {
    throw new TypeError("API_PROXY_TARGET must not contain a fragment.");
  }

  if (target.pathname !== "/") {
    throw new TypeError("API_PROXY_TARGET must contain only an origin.");
  }

  return target.origin;
}

const apiProxyOrigin = readApiProxyOrigin(process.env.API_PROXY_TARGET);

export const config = {
  rewrites: [
    routes.rewrite("/api/:path*", `${apiProxyOrigin}/api/:path*`),
    routes.rewrite("/:path*", "/index.html"),
  ],
};
