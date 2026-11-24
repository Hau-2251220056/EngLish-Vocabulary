import { useEffect, useSyncExternalStore } from "react";
import { vocabularyService } from "../services/vocabulary-service.js";

let snapshot = Object.freeze({ data: null, status: "idle" });
let pendingRequest = null;
const listeners = new Set();

function publish(next) {
  snapshot = Object.freeze(next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadAdminVocabularyList({ force = false } = {}) {
  if (!force && snapshot.status === "success") return Promise.resolve(snapshot.data);
  if (pendingRequest) return pendingRequest;
  publish({ data: snapshot.data, status: "loading" });
  pendingRequest = vocabularyService.listVocabulary().then(
    (data) => {
      publish({ data, status: "success" });
      return data;
    },
    (error) => {
      publish({ data: null, status: "error" });
      throw error;
    },
  ).finally(() => { pendingRequest = null; });
  return pendingRequest;
}

export function publishAdminVocabularyList(data) {
  publish({ data, status: "success" });
}

export function upsertAdminVocabularySummary(summary) {
  if (snapshot.status !== "success") return;
  const index = snapshot.data.findIndex((item) => item.id === summary.id);
  publish({
    data: index === -1
      ? [summary, ...snapshot.data]
      : snapshot.data.map((item) => item.id === summary.id ? summary : item),
    status: "success",
  });
}

export function removeAdminVocabularySummary(vocabularyId) {
  if (snapshot.status !== "success") return;
  publish({ data: snapshot.data.filter((item) => item.id !== vocabularyId), status: "success" });
}

export function useAdminVocabularyCount(enabled) {
  const current = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  useEffect(() => {
    if (enabled && current.status === "idle") void loadAdminVocabularyList().catch(() => {});
  }, [current.status, enabled]);
  if (!enabled) return { count: null, status: "idle" };
  return {
    count: current.status === "success" ? current.data.length : null,
    status: current.status,
  };
}
