// @ts-nocheck
export function createVocabularySetController({ vocabularySetService }) {
  return {
    async listPublicByTopic(req, res, next) {
      try {
        const sets = await vocabularySetService.listPublicSystemSets(req.params.topicId);
        res.status(200).json({ success: true, data: sets });
      } catch (error) {
        handleKnownVocabularySetError(error, res, next);
      }
    },

    async getPublicById(req, res, next) {
      try {
        const set = await vocabularySetService.getPublicSystemSet(req.params.setId);
        res.status(200).json({ success: true, data: set });
      } catch (error) {
        handleKnownVocabularySetError(error, res, next);
      }
    },

    async listSystem(req, res, next) {
      try {
        const sets = await vocabularySetService.listSystemSets();
        res.status(200).json({ success: true, data: sets });
      } catch (error) {
        handleKnownVocabularySetError(error, res, next);
      }
    },

    async getSystemById(req, res, next) {
      try {
        const set = await vocabularySetService.getSystemSet(req.params.setId);
        res.status(200).json({ success: true, data: set });
      } catch (error) {
        handleKnownVocabularySetError(error, res, next);
      }
    },

    async createSystem(req, res, next) {
      try {
        const set = await vocabularySetService.createSystemSet(req.user.id, req.body);
        res.status(201).json({ success: true, data: set });
      } catch (error) {
        handleKnownVocabularySetError(error, res, next);
      }
    },

    async updateSystem(req, res, next) {
      try {
        const set = await vocabularySetService.updateSystemSet(req.params.setId, req.body);
        res.status(200).json({ success: true, data: set });
      } catch (error) {
        handleKnownVocabularySetError(error, res, next);
      }
    },

    async deleteSystem(req, res, next) {
      try {
        await vocabularySetService.deleteSystemSet(req.params.setId);
        res.status(204).send();
      } catch (error) {
        handleKnownVocabularySetError(error, res, next);
      }
    },

    async listPrivate(req, res, next) {
      try {
        const sets = await vocabularySetService.listPrivateSets(req.user.id);
        res.status(200).json({ success: true, data: sets });
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async getPrivate(req, res, next) {
      try {
        const set = await vocabularySetService.getPrivateSet(req.user.id, req.params.setId);
        res.status(200).json({ success: true, data: set });
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async createPrivate(req, res, next) {
      try {
        const set = await vocabularySetService.createPrivateSet(req.user.id, req.body);
        res.status(201).json({ success: true, data: set });
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async updatePrivate(req, res, next) {
      try {
        const set = await vocabularySetService.updatePrivateSet(req.user.id, req.params.setId, req.body);
        res.status(200).json({ success: true, data: set });
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async deletePrivate(req, res, next) {
      try {
        await vocabularySetService.deletePrivateSet(req.user.id, req.params.setId);
        res.status(204).send();
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async copySystem(req, res, next) {
      try {
        const set = await vocabularySetService.copySystemSet(req.user.id, req.params.setId);
        res.status(201).json({ success: true, data: set });
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async searchPicker(req, res, next) {
      try {
        const vocabulary = await vocabularySetService.searchVocabularyPicker(req.query.query);
        res.status(200).json({ success: true, data: vocabulary });
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },
  };
}

function handleKnownVocabularySetError(error, res, next) {
  const statusByCode = {
    VALIDATION_ERROR: 400,
    VOCABULARY_SET_NOT_FOUND: 404,
    TOPIC_NOT_FOUND: 404,
    VOCABULARY_NOT_FOUND: 404,
    VOCABULARY_ALREADY_IN_SET: 409,
  };
  const status = statusByCode[error?.code];
  if (!status) return next(error);
  res.status(status).json({ success: false, error: { code: error.code, message: error.message } });
}
