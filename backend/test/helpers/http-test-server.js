export async function startHttpTestServer(app) {
  const server = await new Promise((resolve, reject) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => {
      resolve(listeningServer);
    });
    listeningServer.once("error", reject);
  });
  const address = server.address();

  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("HTTP test server did not expose a TCP address.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    request(path, options = {}) {
      return request(baseUrl, path, options);
    },
    close() {
      return closeServer(server);
    },
  };
}

export async function request(
  baseUrl,
  path,
  { method = "GET", json, rawBody, headers = {}, cookie } = {},
) {
  const requestHeaders = new Headers(headers);
  let body;

  if (json !== undefined) {
    requestHeaders.set("content-type", "application/json");
    body = JSON.stringify(json);
  } else if (rawBody !== undefined) {
    body = rawBody;
  }
  if (cookie) {
    requestHeaders.set("cookie", cookie);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body,
  });
  const text = await response.text();
  let responseJson;

  if (text.length > 0) {
    try {
      responseJson = JSON.parse(text);
    } catch {
      responseJson = undefined;
    }
  }

  return {
    status: response.status,
    headers: response.headers,
    setCookies: response.headers.getSetCookie(),
    text,
    json: responseJson,
  };
}

export function getCookiePair(setCookies, cookieName = "session_id") {
  const prefix = `${cookieName}=`;
  const cookie = setCookies.find((value) => value.startsWith(prefix));
  return cookie?.split(";", 1)[0];
}

export function getCookieValue(cookiePair, cookieName = "session_id") {
  const prefix = `${cookieName}=`;
  if (typeof cookiePair !== "string" || !cookiePair.startsWith(prefix)) {
    return undefined;
  }
  return cookiePair.slice(prefix.length);
}

async function closeServer(server) {
  if (!server.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
