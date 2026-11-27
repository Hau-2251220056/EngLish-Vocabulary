import { previousApplicationDate, toApplicationDate } from "./streak-domain.js";

export const VISIBILITY_MS = 90 * 24 * 60 * 60 * 1000;
export const STREAK_MILESTONES = [3, 7, 14, 30];
export const VOCABULARY_MILESTONES = [25, 50, 100, 250, 500, 1000];

function addDays(date, days) {
  const utc = new Date(`${date}T00:00:00.000Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function vietnamMidnight(date) {
  return new Date(`${date}T00:00:00+07:00`);
}

// 30 warm-up days ensure an already-running streak's milestones stay outside
// the eligible period even when its actual first day is outside the query.
export function streakQueryStart(visibleSince) {
  return addDays(toApplicationDate(visibleSince), -30);
}

export function projectNotificationEvents({ days, progressDates, now, eligibleSince }) {
  const events = [];
  let lastDay;
  let runLength = 0;
  const today = toApplicationDate(now);
  const available = (date) => date >= eligibleSince && date <= now;

  function interruption(day) {
    const occurredAt = vietnamMidnight(addDays(day, 2));
    if (available(occurredAt)) events.push({
      type: "STREAK_INTERRUPTED", event_key: day, occurred_at: occurredAt, payload: {},
    });
  }

  for (const { day, qualified_at } of days) {
    if (day > today || day === lastDay) continue;
    if (lastDay !== previousApplicationDate(day)) {
      if (lastDay) interruption(lastDay);
      runLength = 0;
    }
    runLength += 1;
    lastDay = day;
    const occurredAt = new Date(qualified_at);
    if (STREAK_MILESTONES.includes(runLength) && available(occurredAt)) {
      // The threshold-reaching date is stable even after the warm-up window moves.
      events.push({
        type: "STREAK_MILESTONE", event_key: `${day}:${runLength}`,
        occurred_at: occurredAt, payload: { days: runLength },
      });
    }
  }
  if (lastDay && lastDay < previousApplicationDate(today)) interruption(lastDay);

  for (const [index, threshold] of VOCABULARY_MILESTONES.entries()) {
    const occurredAt = progressDates[index] && new Date(progressDates[index]);
    if (occurredAt && available(occurredAt)) {
      events.push({
        type: "VOCABULARY_MILESTONE", event_key: String(threshold),
        occurred_at: occurredAt, payload: { started: threshold },
      });
    }
  }
  return events;
}
