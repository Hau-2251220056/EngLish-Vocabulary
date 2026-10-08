import { useRef, useState } from "react";

const SAVED_SETS_KEY = "elvocab.discovery.saved-set-ids.v1";

export function useSavedVocabularySetSession() {
  const [savedSetIds, setSavedSetIds] = useState(readSessionSavedSetIds);
  const copyLocksRef = useRef(new Set());

  function beginCopy(setId) {
    if (savedSetIds.has(setId) || readSessionSavedSetIds().has(setId) || copyLocksRef.current.has(setId)) return false;
    copyLocksRef.current.add(setId);
    return true;
  }

  function completeCopy(setId) {
    copyLocksRef.current.delete(setId);
    const persisted = readSessionSavedSetIds();
    persisted.add(setId);
    writeSessionSavedSetIds(persisted);
    setSavedSetIds((current) => new Set(current).add(setId));
  }

  function failCopy(setId) {
    copyLocksRef.current.delete(setId);
  }

  return { beginCopy, completeCopy, failCopy, savedSetIds };
}

function readSessionSavedSetIds() {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(SAVED_SETS_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSessionSavedSetIds(savedSetIds) {
  try {
    window.sessionStorage.setItem(SAVED_SETS_KEY, JSON.stringify([...savedSetIds]));
  } catch {
    // Session feedback is best-effort and never affects the authoritative copy result.
  }
}
