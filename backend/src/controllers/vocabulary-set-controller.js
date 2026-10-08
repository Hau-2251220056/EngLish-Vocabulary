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
        const result = await vocabularySetService.updateSystemSet(req.params.setId, req.body);
        sendMutationResult(res, result);
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
        const result = await vocabularySetService.updatePrivateSet(req.user.id, req.params.setId, req.body);
        sendMutationResult(res, result);
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

    async uploadSystemCover(req, res, next) {
      try {
        const result = await vocabularySetService.uploadSystemCover(req.params.setId, req.file);
        sendCoverResult(res, result);
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async removeSystemCover(req, res, next) {
      try {
        const result = await vocabularySetService.removeSystemCover(req.params.setId);
        sendCoverResult(res, result);
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async cleanupSystemCover(req, res, next) {
      try {
        const result = await vocabularySetService.cleanupSystemCover(req.params.setId);
        sendCoverResult(res, result);
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async uploadPrivateCover(req, res, next) {
      try {
        const result = await vocabularySetService.uploadPrivateCover(req.user.id, req.params.setId, req.file);
        sendCoverResult(res, result);
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async removePrivateCover(req, res, next) {
      try {
        const result = await vocabularySetService.removePrivateCover(req.user.id, req.params.setId);
        sendCoverResult(res, result);
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async cleanupPrivateCover(req, res, next) {
      try {
        const result = await vocabularySetService.cleanupPrivateCover(req.user.id, req.params.setId);
        sendCoverResult(res, result);
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async searchPicker(req, res, next) {
      try {
        const vocabulary = await vocabularySetService.searchVocabularyPicker(
          req.user.id,
          req.user.role,
          req.query.query,
        );
        res.status(200).json({ success: true, data: vocabulary });
      } catch (error) { handleKnownVocabularySetError(error, res, next); }
    },

    async createPrivateVocabularyAndAdd(req, res, next) {
      try {
        const result = await vocabularySetService.createPrivateVocabularyAndAdd(
          req.user.id,
          req.params.setId,
          req.body,
        );
        res.status(result.created ? 201 : 200).json({ success: true, data: result.data });
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
    PRIVATE_VOCABULARY_OPERATION_CONFLICT: 409,
    COVER_FILE_TOO_LARGE: 413,
    UNSUPPORTED_COVER_MEDIA_TYPE: 415,
    COVER_PROCESSING_BUSY: 503,
    COVER_PROCESSING_TIMEOUT: 503,
    COVER_PROCESSING_UNAVAILABLE: 503,
    COVER_STORAGE_UNAVAILABLE: 503,
    COVER_STORAGE_FAILED: 502,
    COVER_STORAGE_CLEANUP_FAILED: 502,
  };
  const status = statusByCode[error?.code];
  if (!status) return next(error);
  const payload = { code: error.code, message: error.message };
  if (error.details?.orphan_set_id) payload.details = { orphan_set_id: error.details.orphan_set_id };
  res.status(status).json({ success: false, error: payload });
}

function sendMutationResult(res, result) {
  res.status(200).json({
    success: true,
    data: result.data,
    meta: { storage_cleanup: result.storage_cleanup },
  });
}

function sendCoverResult(res, result) {
  res.status(200).json({
    success: true,
    data: result.data,
    meta: { storage_cleanup: result.storage_cleanup },
  });
}
