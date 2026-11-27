import { httpClient } from "../services/http-client.js";
import { NOTIFICATION_PAGE_SIZE } from "./learner-notification-cache.js";

const endpoint = "/api/users/me/notifications";
const timeout = 8000;
const mutation = { timeout, headers: { "X-ELVocab-Notification": "1" } };

export const learnerNotificationApi = {
  async refresh(signal) {
    return (await httpClient.post(`${endpoint}/refresh`, undefined, {
      ...mutation, params: { limit: NOTIFICATION_PAGE_SIZE }, signal,
    })).data.data;
  },
  async list(cursor, signal) {
    return (await httpClient.get(endpoint, { params: { cursor, limit: NOTIFICATION_PAGE_SIZE }, signal, timeout })).data.data;
  },
  async markOne(id, signal) {
    return (await httpClient.patch(`${endpoint}/${encodeURIComponent(id)}/read`, undefined, { ...mutation, signal })).data.data;
  },
  async markAll(signal) {
    return (await httpClient.post(`${endpoint}/read-all`, undefined, { ...mutation, signal })).data.data;
  },
};
