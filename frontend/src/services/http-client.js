import axios from "axios";

export const httpClient = axios.create({
  withCredentials: true,
});

httpClient.interceptors.response.use((response) => {
  const { method, url = "" } = response.config;
  const result = response.data?.data;
  if (method === "post" && result?.session?.state === "COMPLETED"
    && result.replayed !== true && result.reward?.replayed !== true
    && (/^\/api\/learning-sessions\/[^/]+\/complete$/.test(url)
      || url === "/api/learning/events" || url === "/api/quiz/answers")) {
    globalThis.window?.dispatchEvent(new Event("elvocab:learner-notifications-stale"));
  }
  return response;
});
