import { formatNewXpFeedback } from "../services/xp-level-response.js";
import { notifications } from "./notification-service.js";

export function showXpRewardToast(reward, shownSourceEvents, notify = notifications.success) {
  const feedback = formatNewXpFeedback(reward);
  if (!feedback || shownSourceEvents.has(reward.source_event_id)) return false;

  shownSourceEvents.add(reward.source_event_id);
  notify(`Bạn vừa nhận ${feedback}!`, `xp-reward:${reward.source_event_id}`);
  return true;
}
