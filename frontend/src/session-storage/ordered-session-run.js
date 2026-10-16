export const MAX_SESSION_BATCH_SIZE = 10;

export function createOrderedSessionRun(vocabularyIds, { batchSize = MAX_SESSION_BATCH_SIZE } = {}) {
  const snapshotIds = validateIds(vocabularyIds);
  validateBatchSize(batchSize);
  const batches = partition(snapshotIds, batchSize);
  const hasItems = batches.length > 0;
  return {
    snapshot_ids: snapshotIds,
    batches,
    active_batch_index: hasItems ? 0 : null,
    current_vocabulary_id: hasItems ? batches[0][0] : null,
    batch_status: hasItems ? "ACTIVE" : "COMPLETED",
    run_status: hasItems ? "ACTIVE" : "COMPLETED",
  };
}

export function reconcileOrderedSessionRun(run, authorizedVocabularyIds) {
  validateRun(run);
  const authorized = new Set(validateIds(authorizedVocabularyIds));
  const snapshotIds = run.snapshot_ids.filter((id) => authorized.has(id));
  const batches = run.batches.map((batch) => batch.filter((id) => authorized.has(id)));

  if (run.run_status === "COMPLETED") {
    return { ...run, snapshot_ids: snapshotIds, batches };
  }

  if (run.batch_status === "COMPLETED" && run.active_batch_index !== null) {
    return {
      ...run,
      snapshot_ids: snapshotIds,
      batches,
      current_vocabulary_id: null,
    };
  }

  const activeIndex = nextNonEmptyBatchIndex(batches, run.active_batch_index ?? 0);
  if (activeIndex === null) {
    return {
      ...run,
      snapshot_ids: snapshotIds,
      batches,
      active_batch_index: null,
      current_vocabulary_id: null,
      batch_status: "COMPLETED",
      run_status: "COMPLETED",
    };
  }

  const activeBatch = batches[activeIndex];
  const currentId = activeIndex === run.active_batch_index
    && activeBatch.includes(run.current_vocabulary_id)
    ? run.current_vocabulary_id
    : activeBatch[0];
  return {
    ...run,
    snapshot_ids: snapshotIds,
    batches,
    active_batch_index: activeIndex,
    current_vocabulary_id: currentId,
    batch_status: activeIndex === run.active_batch_index ? run.batch_status : "ACTIVE",
  };
}

export function selectOrderedSessionItem(run, vocabularyId) {
  validateRun(run);
  const batch = currentBatch(run);
  return run.run_status === "ACTIVE" && run.batch_status === "ACTIVE" && batch.includes(vocabularyId)
    ? { ...run, current_vocabulary_id: vocabularyId }
    : run;
}

export function completeOrderedSessionBatch(run) {
  validateRun(run);
  if (run.run_status !== "ACTIVE" || run.active_batch_index === null) return run;
  const nextIndex = nextNonEmptyBatchIndex(run.batches, run.active_batch_index + 1);
  return {
    ...run,
    batch_status: "COMPLETED",
    current_vocabulary_id: null,
    run_status: nextIndex === null ? "COMPLETED" : "ACTIVE",
  };
}

export function advanceOrderedSessionBatch(run) {
  validateRun(run);
  if (run.run_status !== "ACTIVE" || run.batch_status !== "COMPLETED") return run;
  const nextIndex = nextNonEmptyBatchIndex(run.batches, (run.active_batch_index ?? -1) + 1);
  if (nextIndex === null) {
    return { ...run, active_batch_index: null, current_vocabulary_id: null, run_status: "COMPLETED" };
  }
  return {
    ...run,
    active_batch_index: nextIndex,
    current_vocabulary_id: run.batches[nextIndex][0],
    batch_status: "ACTIVE",
  };
}

export function restartOrderedSessionRun(latestAuthorizedVocabularyIds, options) {
  return createOrderedSessionRun(latestAuthorizedVocabularyIds, options);
}

export function currentOrderedSessionBatch(run) {
  validateRun(run);
  return [...currentBatch(run)];
}

export function isOrderedSessionRun(value) {
  try {
    validateRun(value);
    return true;
  } catch {
    return false;
  }
}

function validateRun(run) {
  if (!run || typeof run !== "object" || Array.isArray(run)) throw new TypeError("Ordered session run is invalid.");
  const snapshotIds = validateIds(run.snapshot_ids);
  if (!Array.isArray(run.batches) || !run.batches.every(Array.isArray)) throw new TypeError("Ordered session batches are invalid.");
  const flattened = run.batches.flat();
  validateIds(flattened);
  if (flattened.length !== snapshotIds.length || flattened.some((id, index) => id !== snapshotIds[index])) {
    throw new TypeError("Ordered session batch boundaries are invalid.");
  }
  if (run.batches.some((batch) => batch.length > MAX_SESSION_BATCH_SIZE)) throw new TypeError("Ordered session batch is too large.");
  if (!new Set(["ACTIVE", "COMPLETED"]).has(run.batch_status)
    || !new Set(["ACTIVE", "COMPLETED"]).has(run.run_status)) throw new TypeError("Ordered session lifecycle is invalid.");
  if (run.active_batch_index !== null
    && (!Number.isSafeInteger(run.active_batch_index) || run.active_batch_index < 0 || run.active_batch_index >= run.batches.length)) {
    throw new TypeError("Ordered session batch index is invalid.");
  }
  if (run.current_vocabulary_id !== null && typeof run.current_vocabulary_id !== "string") {
    throw new TypeError("Ordered session cursor is invalid.");
  }
  if (run.run_status === "ACTIVE" && run.active_batch_index === null) {
    throw new TypeError("Active ordered session requires a batch.");
  }
  if (run.batch_status === "ACTIVE") {
    const batch = currentBatch(run);
    if (run.run_status !== "ACTIVE" || !batch.includes(run.current_vocabulary_id)) {
      throw new TypeError("Active ordered session cursor is invalid.");
    }
  } else if (run.current_vocabulary_id !== null) {
    throw new TypeError("Completed ordered session batch cannot retain a cursor.");
  }
  if (run.run_status === "COMPLETED" && run.batch_status !== "COMPLETED") {
    throw new TypeError("Completed ordered session lifecycle is invalid.");
  }
}

function validateIds(values) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new TypeError("Vocabulary IDs are invalid.");
  }
  if (new Set(values).size !== values.length) throw new TypeError("Vocabulary IDs must be distinct.");
  return [...values];
}

function validateBatchSize(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_SESSION_BATCH_SIZE) {
    throw new TypeError("Session batch size is invalid.");
  }
}

function partition(values, batchSize) {
  const batches = [];
  for (let index = 0; index < values.length; index += batchSize) {
    batches.push(values.slice(index, index + batchSize));
  }
  return batches;
}

function currentBatch(run) {
  return run.active_batch_index === null ? [] : run.batches[run.active_batch_index];
}

function nextNonEmptyBatchIndex(batches, startIndex) {
  for (let index = Math.max(0, startIndex); index < batches.length; index += 1) {
    if (batches[index].length > 0) return index;
  }
  return null;
}
