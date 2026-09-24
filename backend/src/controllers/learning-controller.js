// @ts-nocheck
export function createLearningController({ learningService }) {
  return {
    async getSet(req, res, next) {
      try {
        const learningSet = await learningService.getLearningSet(
          req.user.id,
          req.params.setId,
        );
        res.status(200).json({ success: true, data: learningSet });
      } catch (error) {
        handleKnownLearningError(error, res, next);
      }
    },

    async recordEvent(req, res, next) {
      try {
        const progress = await learningService.recordMeaningfulEvent(
          req.user.id,
          req.body,
        );
        res.status(200).json({ success: true, data: progress });
      } catch (error) {
        handleKnownLearningError(error, res, next);
      }
    },
  };
}

function handleKnownLearningError(error, res, next) {
  const statusByCode = {
    VALIDATION_ERROR: 400,
    LEARNING_SET_NOT_FOUND: 404,
    LEARNING_SET_EMPTY: 409,
    LEARNING_SET_ITEM_CHANGED: 409,
    LEARNING_PROGRESS_CHANGED: 409,
  };
  const status = statusByCode[error?.code];
  if (!status) {
    next(error);
    return;
  }

  res.status(status).json({
    success: false,
    error: { code: error.code, message: error.message },
  });
}
