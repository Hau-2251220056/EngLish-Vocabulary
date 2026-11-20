export function createPrivateVocabularyAction(vocabulary, createOperationId = defaultOperationId) {
  const action = {
    operation_id: createOperationId(),
    vocabulary,
    state: "idle",
    result: null,
    error: null,
    prepare(nextVocabulary) {
      if (action.state === "idle" || action.error?.kind === "validation") {
        action.vocabulary = nextVocabulary;
      }
    },
  };
  return action;
}

export function createPrivateVocabularySubmitter(service) {
  const inFlight = new Map();

  return function submit(setId, action) {
    const existing = inFlight.get(action.operation_id);
    if (existing) return existing;

    action.state = "pending";
    action.error = null;
    const request = service.createPrivateVocabularyAndAdd(
      setId,
      action.operation_id,
      action.vocabulary,
    ).then(
      (result) => {
        action.state = "success";
        action.result = result;
        return result;
      },
      (error) => {
        action.state = "error";
        action.error = error;
        throw error;
      },
    ).finally(() => {
      if (inFlight.get(action.operation_id) === request) inFlight.delete(action.operation_id);
    });
    inFlight.set(action.operation_id, request);
    return request;
  };
}

function defaultOperationId() {
  return crypto.randomUUID();
}
