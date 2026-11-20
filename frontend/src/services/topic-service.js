import { httpClient } from "./http-client.js";

const TOPIC_ENDPOINT = "/api/topics";
const ADMIN_TOPIC_ENDPOINT = "/api/admin/topics";

export class TopicApiError extends Error {
  constructor({ kind, code, message, status }) {
    super(message);
    this.name = "TopicApiError";
    this.kind = kind;
    this.code = code;
    this.status = status;
  }
}

export function createTopicService(client = httpClient) {
  return {
    async listTopics() {
      try {
        const response = await client.get(TOPIC_ENDPOINT);
        const topics = response.data?.data;
        if (!Array.isArray(topics)) throw invalidResponseError();
        return topics;
      } catch (error) {
        throw mapTopicError(error);
      }
    },

    async getTopic(topicId) {
      try {
        const response = await client.get(
          `${TOPIC_ENDPOINT}/${encodeURIComponent(topicId)}`,
        );
        const topic = response.data?.data;
        if (!topic || typeof topic !== "object" || Array.isArray(topic)) {
          throw invalidResponseError();
        }
        return topic;
      } catch (error) {
        throw mapTopicError(error);
      }
    },

    async createTopic(input) {
      try {
        const response = await client.post(ADMIN_TOPIC_ENDPOINT, input);
        return requireTopic(response.data?.data);
      } catch (error) {
        throw mapTopicError(error);
      }
    },

    async updateTopic(topicId, input) {
      try {
        const response = await client.patch(
          `${ADMIN_TOPIC_ENDPOINT}/${encodeURIComponent(topicId)}`,
          input,
        );
        return requireTopic(response.data?.data);
      } catch (error) {
        throw mapTopicError(error);
      }
    },

    async deleteTopic(topicId) {
      try {
        await client.delete(
          `${ADMIN_TOPIC_ENDPOINT}/${encodeURIComponent(topicId)}`,
        );
      } catch (error) {
        throw mapTopicError(error);
      }
    },
  };
}

function mapTopicError(error) {
  if (error instanceof TopicApiError) return error;

  const status = error?.response?.status ?? null;
  const responseError = error?.response?.data?.error;
  const code = responseError?.code ?? "TOPIC_REQUEST_FAILED";
  const isNotFound = status === 404 && code === "TOPIC_NOT_FOUND";

  return new TopicApiError({
    kind: isNotFound ? "not-found" : status === null ? "operational" : "api",
    code,
    message:
      responseError?.message ??
      (status === null
        ? "Topic service is unavailable."
        : "Topic request failed."),
    status,
  });
}

function invalidResponseError() {
  return new TopicApiError({
    kind: "operational",
    code: "INVALID_TOPIC_RESPONSE",
    message: "Topic service returned an invalid response.",
    status: null,
  });
}

function requireTopic(topic) {
  if (!topic || typeof topic !== "object" || Array.isArray(topic)) {
    throw invalidResponseError();
  }
  return topic;
}

export const topicService = createTopicService();
