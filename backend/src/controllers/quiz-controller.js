// @ts-nocheck
export function createQuizController({ quizService }) {
  return {
    async getQuestions(req, res, next) {
      try {
        const questions = await quizService.getQuestions(
          req.user.id,
          req.params.setId,
          req.query,
        );
        res.status(200).json({ success: true, data: questions });
      } catch (error) {
        handleKnownQuizError(error, res, next);
      }
    },

    async recordAnswer(req, res, next) {
      try {
        const result = await quizService.recordAnswer(req.user.id, req.body);
        res.status(200).json({ success: true, data: result });
      } catch (error) {
        handleKnownQuizError(error, res, next);
      }
    },
  };
}

function handleKnownQuizError(error, res, next) {
  const statusByCode = {
    QUIZ_VALIDATION_ERROR: 400,
    QUIZ_SET_NOT_FOUND: 404,
    QUIZ_SET_EMPTY: 409,
    QUIZ_ITEM_CHANGED: 409,
    QUIZ_QUESTION_CHANGED: 409,
    QUIZ_RETRY_CONFLICT: 409,
    QUIZ_PROGRESS_CONFLICT: 409,
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
