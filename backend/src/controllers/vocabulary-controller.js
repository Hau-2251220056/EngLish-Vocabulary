// @ts-nocheck
export function createVocabularyController({ vocabularyService }) {
  return {
    async list(req, res, next) {
      try {
        const vocabulary = await vocabularyService.listVocabulary();
        res.status(200).json({ success: true, data: vocabulary });
      } catch (error) {
        next(error);
      }
    },

    async getById(req, res, next) {
      try {
        const vocabulary = await vocabularyService.getVocabulary(
          req.params.vocabularyId,
        );
        res.status(200).json({ success: true, data: vocabulary });
      } catch (error) {
        handleKnownVocabularyError(error, res, next);
      }
    },

    async create(req, res, next) {
      try {
        const vocabulary = await vocabularyService.createVocabulary(req.body);
        res.status(201).json({ success: true, data: vocabulary });
      } catch (error) {
        handleKnownVocabularyError(error, res, next);
      }
    },

    async update(req, res, next) {
      try {
        const vocabulary = await vocabularyService.updateVocabulary(
          req.params.vocabularyId,
          req.body,
        );
        res.status(200).json({ success: true, data: vocabulary });
      } catch (error) {
        handleKnownVocabularyError(error, res, next);
      }
    },

    async delete(req, res, next) {
      try {
        await vocabularyService.deleteVocabulary(req.params.vocabularyId);
        res.status(204).send();
      } catch (error) {
        handleKnownVocabularyError(error, res, next);
      }
    },
  };
}

function handleKnownVocabularyError(error, res, next) {
  const statusByCode = {
    VALIDATION_ERROR: 400,
    VOCABULARY_NOT_FOUND: 404,
    VOCABULARY_WORD_ALREADY_EXISTS: 409,
  };
  const status = statusByCode[error?.code];

  if (!status) {
    next(error);
    return;
  }

  res.status(status).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
  });
}
