// @ts-nocheck
export function createTopicController({ topicService }) {
  return {
    async list(req, res, next) {
      try {
        const topics = await topicService.listTopics();
        res.status(200).json({ success: true, data: topics });
      } catch (error) {
        next(error);
      }
    },

    async getById(req, res, next) {
      try {
        const topic = await topicService.getTopic(req.params.topicId);
        res.status(200).json({ success: true, data: topic });
      } catch (error) {
        handleKnownTopicError(error, res, next);
      }
    },

    async create(req, res, next) {
      try {
        const topic = await topicService.createTopic(req.body);
        res.status(201).json({ success: true, data: topic });
      } catch (error) {
        handleKnownTopicError(error, res, next);
      }
    },

    async update(req, res, next) {
      try {
        const topic = await topicService.updateTopic(
          req.params.topicId,
          req.body,
        );
        res.status(200).json({ success: true, data: topic });
      } catch (error) {
        handleKnownTopicError(error, res, next);
      }
    },

    async delete(req, res, next) {
      try {
        await topicService.deleteTopic(req.params.topicId);
        res.status(204).send();
      } catch (error) {
        handleKnownTopicError(error, res, next);
      }
    },
  };
}

function handleKnownTopicError(error, res, next) {
  const statusByCode = {
    VALIDATION_ERROR: 400,
    TOPIC_NOT_FOUND: 404,
    TOPIC_NAME_ALREADY_EXISTS: 409,
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
