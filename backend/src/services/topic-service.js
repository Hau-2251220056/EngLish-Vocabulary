// @ts-nocheck
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EDITABLE_FIELDS = new Set(["name", "description"]);

export class TopicServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TopicServiceError";
    this.code = code;
  }
}

export function createTopicService({ topicRepository }) {
  return {
    listTopics() {
      return topicRepository.list();
    },

    async getTopic(topicId) {
      validateTopicId(topicId);
      return requireTopic(topicRepository, topicId);
    },

    async createTopic(input) {
      validateBody(input);
      rejectUnsupportedFields(input);

      const name = validateName(input.name);
      const description = validateDescription(input.description, {
        optional: true,
      });
      await ensureUniqueName(topicRepository, name);

      try {
        return await topicRepository.create({ name, description });
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },

    async updateTopic(topicId, input) {
      validateTopicId(topicId);
      validateBody(input);
      rejectUnsupportedFields(input);

      const hasName = Object.hasOwn(input, "name");
      const hasDescription = Object.hasOwn(input, "description");
      if (!hasName && !hasDescription) {
        throw validationError();
      }

      await requireTopic(topicRepository, topicId);
      const data = {};

      if (hasName) {
        data.name = validateName(input.name);
        await ensureUniqueName(topicRepository, data.name, topicId);
      }
      if (hasDescription) {
        data.description = validateDescription(input.description);
      }

      try {
        return await topicRepository.update(topicId, data);
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },

    async deleteTopic(topicId) {
      validateTopicId(topicId);
      await requireTopic(topicRepository, topicId);

      try {
        await topicRepository.delete(topicId);
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },
  };
}

function validateTopicId(topicId) {
  if (typeof topicId !== "string" || !UUID_PATTERN.test(topicId)) {
    throw validationError();
  }
}

function validateBody(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError();
  }
}

function rejectUnsupportedFields(input) {
  if (Object.keys(input).some((field) => !EDITABLE_FIELDS.has(field))) {
    throw validationError();
  }
}

function validateName(value) {
  if (typeof value !== "string") {
    throw validationError();
  }

  const name = value.trim();
  if (name.length === 0 || name.length > 100) {
    throw validationError();
  }

  return name;
}

function validateDescription(value, { optional = false } = {}) {
  if (optional && value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length > 500) {
    throw validationError();
  }

  return value;
}

async function requireTopic(topicRepository, topicId) {
  const topic = await topicRepository.findById(topicId);
  if (!topic) {
    throw topicNotFoundError();
  }
  return topic;
}

async function ensureUniqueName(topicRepository, name, currentTopicId) {
  const topic = await topicRepository.findByNameInsensitive(name);
  if (topic && topic.id !== currentTopicId) {
    throw duplicateNameError();
  }
}

function throwKnownPersistenceError(error) {
  if (error?.code === "P2002") {
    throw duplicateNameError();
  }
  if (error?.code === "P2025") {
    throw topicNotFoundError();
  }
  throw error;
}

function validationError() {
  return new TopicServiceError(
    "VALIDATION_ERROR",
    "Topic request data is invalid.",
  );
}

function topicNotFoundError() {
  return new TopicServiceError("TOPIC_NOT_FOUND", "Topic was not found.");
}

function duplicateNameError() {
  return new TopicServiceError(
    "TOPIC_NAME_ALREADY_EXISTS",
    "A Topic with this name already exists.",
  );
}
