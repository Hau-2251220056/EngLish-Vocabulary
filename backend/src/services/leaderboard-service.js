import { projectCurrentStreak, STREAK_TIME_ZONE, toApplicationDate } from "./streak-domain.js";

const PAGE_SIZE = 10;
const PERIODS = new Set(["weekly", "monthly", "all"]);
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1_000;
const UUID_LIKE = /[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}/iu;

export class LeaderboardError extends Error {
  constructor(status, code, message) {
    super(message);
    Object.assign(this, { status, code });
  }
}

export function createLeaderboardService({ repository, now = () => new Date() }) {
  return {
    async list(userId, query) {
      const { period, page } = parseQuery(query);
      const asOf = new Date(now()).toISOString();
      const applicationDate = toApplicationDate(asOf);
      const window = periodWindow(period, applicationDate);
      const first = (page - 1) * PAGE_SIZE + 1;
      const last = first + PAGE_SIZE - 1;
      const { rows, activityDays } = await repository.readSnapshot({
        userId, period, asOf, applicationDate, ...window, first, last,
      });
      const viewer = rows.find(({ id }) => id === userId);
      if (!viewer) throw new LeaderboardError(401, "AUTHENTICATION_FAILED", "Authentication failed.");
      const datesByUser = new Map(rows.map(({ id }) => [id, []]));
      for (const day of activityDays) {
        datesByUser.get(day.user_id).push(day.activity_date.toISOString().slice(0, 10));
      }

      const ranked = rows.map((row) => ({
        rank: row.rank === null ? null : asSafeInteger(row.rank),
        position: row.position === null ? null : asSafeInteger(row.position),
        display_name: displayName(row, row.id === userId),
        // No existing learner avatar source has been verified for cross-user use.
        avatar_url: null,
        xp: asSafeInteger(row.xp),
        current_streak: projectCurrentStreak(datesByUser.get(row.id), asOf).current_streak,
        is_me: row.id === userId,
      }));
      const me = ranked.find(({ is_me }) => is_me);
      const total = asSafeInteger(viewer.total);
      return {
        period, timezone: STREAK_TIME_ZONE, window, as_of: asOf,
        xp_basis: period === "all" ? "lifetime_total" : "period_rewards",
        top: ranked.filter(({ position }) => position !== null && position <= 3),
        items: ranked.filter(({ position }) => position >= first && position <= last),
        me: { ...me, page: me.position === null ? null : Math.ceil(me.position / PAGE_SIZE) },
        pagination: { page, page_size: PAGE_SIZE, total_items: total, total_pages: Math.ceil(total / PAGE_SIZE) },
      };
    },
  };
}

function parseQuery(query) {
  const { period = "weekly", page = "1" } = query;
  if (Object.keys(query).some((key) => key !== "period" && key !== "page")
    || !PERIODS.has(period) || typeof page !== "string" || !/^[1-9]\d{0,9}$/.test(page)
    || Number(page) > 2_147_483_647) {
    throw new LeaderboardError(400, "VALIDATION_ERROR", "Invalid leaderboard query.");
  }
  return { period, page: Number(page) };
}

function periodWindow(period, applicationDate) {
  if (period === "all") return { start: null, end: null };
  const start = new Date(`${applicationDate}T00:00:00.000Z`);
  if (period === "monthly") start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const end = new Date(start);
  if (period === "monthly") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + 7);
  // Current Vietnam calendar dates use UTC+07:00 year-round.
  return {
    start: new Date(start.getTime() - VIETNAM_OFFSET_MS).toISOString(),
    end: new Date(end.getTime() - VIETNAM_OFFSET_MS).toISOString(),
  };
}

function displayName(row, isMe) {
  const name = row.display_name.normalize("NFKC").trim().replace(/[\p{Cc}\p{Cf}]/gu, "");
  const localPart = row.email.split("@")[0];
  const comparable = comparableName(name);
  if (!comparable || name.includes("@") || UUID_LIKE.test(name)
    || comparable === comparableName(localPart)) {
    return isMe ? "Bạn" : `Học viên ${row.position}`;
  }
  return name;
}

function comparableName(value) {
  return value.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function asSafeInteger(value) {
  const integer = Number(value);
  if (!Number.isSafeInteger(integer) || integer < 0) throw new RangeError("Invalid leaderboard aggregate.");
  return integer;
}
