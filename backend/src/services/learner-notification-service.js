import { projectNotificationEvents, streakQueryStart, VISIBILITY_MS } from "./learner-notification-domain.js";
import { toApplicationDate } from "./streak-domain.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export class LearnerNotificationError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function invalidQuery() {
  return new LearnerNotificationError(400, "NOTIFICATION_VALIDATION_ERROR", "Invalid notification request.");
}

function decodeCursor(cursor) {
  if (typeof cursor !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(cursor)) throw invalidQuery();
  const [at, id, ...rest] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const date = new Date(at);
  if (rest.length || !ISO_UTC.test(at) || !Number.isFinite(date.getTime()) || date.toISOString() !== at || !UUID.test(id ?? "")) throw invalidQuery();
  return { at: date, id };
}

function pageQuery(query, allowCursor) {
  if (Object.keys(query).some((key) => key !== "limit" && (!allowCursor || key !== "cursor"))) throw invalidQuery();
  const limit = query.limit ?? "3";
  if (typeof limit !== "string" || !/^([1-9]|[1-4][0-9]|50)$/.test(limit)) throw invalidQuery();
  return { limit: Number(limit), cursor: query.cursor === undefined ? null : decodeCursor(query.cursor) };
}

async function readPage(repo, userId, since, { cursor, limit }) {
  const { items, unread_count } = await repo.page(userId, since, cursor, limit + 1);
  const has_more = items.length > limit;
  const visible = items.slice(0, limit);
  const last = visible.at(-1);
  return {
    items: visible, unread_count, has_more,
    next_cursor: has_more ? Buffer.from(`${new Date(last.occurred_at).toISOString()}|${last.id}`).toString("base64url") : null,
  };
}

function activationDate(raw) {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw)) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== raw.replace(/(?<!\.\d{3})Z$/, ".000Z")) return null;
  return date;
}

export function createLearnerNotificationService({ repository, now = () => new Date(), activatedAt }) {
  const activation = activationDate(activatedAt);
  const visibilityStart = (instant) => new Date(instant.getTime() - VISIBILITY_MS);

  return {
    list(userId, query) {
      return readPage(repository, userId, visibilityStart(now()), pageQuery(query, true));
    },

    refresh(userId, query) {
      const options = pageQuery(query, false);
      const instant = now();
      const since = visibilityStart(instant);
      if (!activation || activation > instant) return readPage(repository, userId, since, options);
      const eligibleSince = new Date(Math.max(since.getTime(), activation.getTime()));
      return repository.transact(async (repo) => {
        const source = await repo.sources(userId, streakQueryStart(eligibleSince), toApplicationDate(instant), instant);
        await repo.insert(userId, projectNotificationEvents({ ...source, now: instant, eligibleSince }));
        return readPage(repo, userId, since, options);
      });
    },

    markOne(userId, id) {
      if (!UUID.test(id)) throw invalidQuery();
      const instant = now();
      const since = visibilityStart(instant);
      return repository.transact(async (repo) => {
        const item = await repo.markOne(userId, id, since, instant);
        if (!item) throw new LearnerNotificationError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
        return { ...item, unread_count: await repo.unreadCount(userId, since) };
      });
    },

    markAll(userId) {
      const instant = now();
      const since = visibilityStart(instant);
      return repository.transact(async (repo) => {
        await repo.markAll(userId, since, instant);
        return { read_at: instant, unread_count: await repo.unreadCount(userId, since) };
      });
    },
  };
}
