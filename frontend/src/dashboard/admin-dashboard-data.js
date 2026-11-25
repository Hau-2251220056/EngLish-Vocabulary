export const ADMIN_CEFR_LEVELS = Object.freeze(["A1", "A2", "B1", "B2", "C1"]);

export function requireTopicSummaries(value) {
  if (!Array.isArray(value) || value.some((topic) => (
    !topic || typeof topic.id !== "string" || typeof topic.name !== "string"
  ))) throw new TypeError("Admin Topic summaries are invalid.");
  return value;
}

export function requireVocabularySummaries(value) {
  if (!Array.isArray(value) || value.some((item) => !item || typeof item.id !== "string")) {
    throw new TypeError("Admin Vocabulary summaries are invalid.");
  }
  return value;
}

export function requireSystemSetSummaries(value) {
  if (!Array.isArray(value) || value.some((set) => (
    !set || typeof set.id !== "string" || typeof set.topic_id !== "string" ||
    !ADMIN_CEFR_LEVELS.includes(set.cefr_level)
  ))) throw new TypeError("Admin System Set summaries are invalid.");
  return value;
}

export function aggregateCefrDistribution(sets) {
  const counts = new Map(ADMIN_CEFR_LEVELS.map((level) => [level, 0]));
  for (const set of requireSystemSetSummaries(sets)) {
    counts.set(set.cefr_level, counts.get(set.cefr_level) + 1);
  }
  return ADMIN_CEFR_LEVELS.map((level) => ({ level, count: counts.get(level) }));
}

export function aggregateTopicDistribution(topics, sets) {
  const validTopics = requireTopicSummaries(topics);
  const validSets = requireSystemSetSummaries(sets);
  const counts = new Map(validTopics.map((topic) => [topic.id, 0]));

  for (const set of validSets) {
    if (!counts.has(set.topic_id)) {
      throw new TypeError("A System Set references a Topic outside the authoritative Topic list.");
    }
    counts.set(set.topic_id, counts.get(set.topic_id) + 1);
  }

  return validTopics
    .map((topic) => ({ id: topic.id, name: topic.name, count: counts.get(topic.id) }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "vi"));
}

export function selectLeadingCefr(distribution) {
  const highest = Math.max(0, ...distribution.map(({ count }) => count));
  if (highest === 0) return null;
  const leaders = distribution.filter(({ count }) => count === highest);
  return leaders.length === 1 ? leaders[0] : null;
}

export function percentage(count, total) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}
