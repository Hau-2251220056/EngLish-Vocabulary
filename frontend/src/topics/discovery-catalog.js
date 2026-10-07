import { topicService } from "../services/topic-service.js";
import { vocabularySetService } from "../services/vocabulary-set-service.js";

export async function loadDiscoveryCatalog({
  listTopics = () => topicService.listTopics(),
  listPublicSystemSets = (topicId) => vocabularySetService.listPublicSystemSets(topicId),
} = {}) {
  const topics = await listTopics();
  const setsByTopic = await Promise.all(
    topics.map(async (topic) => ({
      sets: await listPublicSystemSets(topic.id),
      topic: { id: topic.id, name: topic.name },
    })),
  );

  return {
    topics,
    sets: setsByTopic.flatMap(({ sets, topic }) =>
      sets.map((set) => ({ ...set, topic })),
    ),
  };
}

export function filterDiscoveryCatalog(sets, { query, topicId }) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return sets.filter((set) => {
    if (topicId && set.topic.id !== topicId) return false;
    if (!normalizedQuery) return true;
    return [set.name, set.description]
      .filter((value) => typeof value === "string")
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function paginateDiscoveryCatalog(sets, page, pageSize = 9) {
  const totalPages = Math.max(1, Math.ceil(sets.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  return { currentPage, items: sets.slice(start, start + pageSize), totalPages };
}
