import { httpClient } from "./http-client.js";

const ENDPOINT = "/api/admin/users";

export class AdminUserApiError extends Error {
  constructor({ code, message, status }) {
    super(message);
    this.name = "AdminUserApiError";
    this.code = code;
    this.status = status;
  }
}

export function createAdminUserService(client = httpClient) {
  return {
    async listUsers({ page = 1, pageSize = 10, query = "", role = "", signal } = {}) {
      try {
        const response = await client.get(ENDPOINT, {
          params: {
            page,
            page_size: pageSize,
            ...(query ? { query } : {}),
            ...(role ? { role } : {}),
          },
          signal,
        });
        return requireList(response.data?.data);
      } catch (error) {
        throw mapError(error);
      }
    },

    async getUser(userId, { signal } = {}) {
      try {
        const response = await client.get(`${ENDPOINT}/${encodeURIComponent(userId)}`, { signal });
        return requireUser(response.data?.data, true);
      } catch (error) {
        throw mapError(error);
      }
    },
  };
}

function requireList(data) {
  if (!data || !Array.isArray(data.items) || !validPagination(data.pagination)) {
    throw invalidResponseError();
  }
  const items = data.items.map((item) => requireUser(item));
  return { items, pagination: data.pagination, filters: data.filters ?? { query: null, role: null } };
}

function requireUser(user, detail = false) {
  const required = ["id", "display_name", "email", "role", "is_active", "created_at"];
  if (!user || typeof user !== "object" || Array.isArray(user) || required.some((field) => !Object.hasOwn(user, field))) {
    throw invalidResponseError();
  }
  if (detail && !Object.hasOwn(user, "updated_at")) throw invalidResponseError();
  return user;
}

function validPagination(value) {
  return value && ["page", "page_size", "total_items", "total_pages"].every((field) => Number.isInteger(value[field]) && value[field] >= 0);
}

function mapError(error) {
  if (error instanceof AdminUserApiError) return error;
  if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError" || error?.name === "AbortError") return error;
  const status = error?.response?.status ?? null;
  const responseError = error?.response?.data?.error;
  return new AdminUserApiError({
    code: responseError?.code ?? "ADMIN_USER_REQUEST_FAILED",
    message: responseError?.message ?? (status === null ? "User service is unavailable." : "User request failed."),
    status,
  });
}

function invalidResponseError() {
  return new AdminUserApiError({ code: "INVALID_ADMIN_USER_RESPONSE", message: "User service returned an invalid response.", status: null });
}

export const adminUserService = createAdminUserService();
