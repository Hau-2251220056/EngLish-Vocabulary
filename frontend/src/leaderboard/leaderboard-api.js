import { httpClient } from "../services/http-client.js";

export async function readLeaderboard(period, page, signal) {
  const { data } = await httpClient.get("/api/leaderboard", {
    params: { period, page }, signal, timeout: 15_000,
  });
  const result = data?.data;
  if (data?.success !== true || !validResult(result, period, page)) {
    throw new Error("Invalid leaderboard response.");
  }
  return result;
}

const isInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const isPositive = (value) => isInteger(value) && value > 0;
const isInstant = (value) => typeof value === "string" && value.endsWith("Z") && Number.isFinite(Date.parse(value));

function validRow(row) {
  return row && typeof row.display_name === "string" && row.display_name.trim().length > 0
    && row.avatar_url === null
    && isInteger(row.xp) && isInteger(row.current_streak) && typeof row.is_me === "boolean"
    && (row.xp > 0 ? isPositive(row.rank) && isPositive(row.position) : row.rank === null && row.position === null);
}

function validResult(result, period, page) {
  if (!result || result.period !== period || result.timezone !== "Asia/Ho_Chi_Minh" || !isInstant(result.as_of)) return false;
  const { window, top, items, me, pagination } = result;
  const allTime = period === "all";
  return window && (allTime ? window.start === null && window.end === null
    : isInstant(window.start) && isInstant(window.end)
      && Date.parse(window.start) <= Date.parse(result.as_of) && Date.parse(result.as_of) < Date.parse(window.end))
    && result.xp_basis === (allTime ? "lifetime_total" : "period_rewards")
    && Array.isArray(top) && top.length <= 3 && top.every((row) => validRow(row) && row.xp > 0)
    && Array.isArray(items) && items.length <= 10 && items.every((row) => validRow(row) && row.xp > 0)
    && validRow(me) && me.is_me && me.page === (me.position === null ? null : Math.ceil(me.position / 10))
    && pagination?.page === page && pagination.page_size === 10 && isInteger(pagination.total_items)
    && pagination.total_pages === Math.ceil(pagination.total_items / 10);
}
