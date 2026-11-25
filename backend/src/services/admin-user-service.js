// @ts-nocheck
import { projectCurrentStreak, toApplicationDate } from "./streak-domain.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUERY_FIELDS = new Set(["page", "page_size", "query", "role"]);
const ROLES = new Set(["USER", "ADMIN"]);
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export class AdminUserServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AdminUserServiceError";
    this.code = code;
  }
}

export function createAdminUserService({ adminUserRepository, now = () => new Date() }) {
  return {
    async listUsers(input) {
      const filters = validateListQuery(input);
      const { items, total } = await adminUserRepository.list(filters);
      const evaluatedAt = now();
      const userIds = items.filter(({ role }) => role === "USER").map(({ id }) => id);
      const streakRows = userIds.length === 0
        ? []
        : await adminUserRepository.listStreakActivityDates(userIds, toApplicationDate(evaluatedAt));
      const activityDatesByUser = groupActivityDates(streakRows);
      const projectedItems = items.map((user) => ({
        ...user,
        current_streak: user.role === "USER"
          ? projectCurrentStreak(activityDatesByUser.get(user.id) ?? [], evaluatedAt).current_streak
          : null,
      }));

      return {
        items: projectedItems,
        pagination: {
          page: filters.page,
          page_size: filters.page_size,
          total_items: total,
          total_pages: total === 0 ? 0 : Math.ceil(total / filters.page_size),
        },
        filters: {
          query: filters.query,
          role: filters.role,
        },
      };
    },

    async getUser(userId) {
      if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
        throw validationError();
      }

      const user = await adminUserRepository.findById(userId);
      if (!user) throw userNotFoundError();
      return user;
    },
  };
}

function groupActivityDates(rows) {
  const grouped = new Map();
  for (const { user_id: userId, activity_date: activityDate } of rows) {
    const dates = grouped.get(userId) ?? [];
    dates.push(activityDate);
    grouped.set(userId, dates);
  }
  return grouped;
}

function validateListQuery(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError();
  }
  if (Object.keys(input).some((field) => !QUERY_FIELDS.has(field))) {
    throw validationError();
  }
  if (Object.values(input).some((value) => typeof value !== "string")) {
    throw validationError();
  }

  const page = Object.hasOwn(input, "page") ? parsePositiveInteger(input.page) : 1;
  const pageSize = Object.hasOwn(input, "page_size")
    ? parsePositiveInteger(input.page_size)
    : DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) throw validationError();

  const query = Object.hasOwn(input, "query") ? input.query.trim() : null;
  const role = Object.hasOwn(input, "role") ? input.role : null;
  if (role !== null && !ROLES.has(role)) throw validationError();

  return { page, page_size: pageSize, query: query || null, role };
}

function parsePositiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value)) throw validationError();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw validationError();
  return parsed;
}

function validationError() {
  return new AdminUserServiceError(
    "VALIDATION_ERROR",
    "Admin user request data is invalid.",
  );
}

function userNotFoundError() {
  return new AdminUserServiceError("USER_NOT_FOUND", "User was not found.");
}
