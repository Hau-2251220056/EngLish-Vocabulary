// @ts-nocheck
export function createDailyGoalController({ dailyGoalService }) {
  return Object.freeze({
    listNotifications: handler((req) => dailyGoalService.listNotifications(req.user.id, req.query), undefined, notificationListDto),
    countUnreadNotifications: handler((req) => dailyGoalService.countUnreadNotifications(req.user.id), undefined, unreadCountDto),
    markNotificationRead: handler((req) => dailyGoalService.markNotificationRead(req.user.id, req.params.id, req.body), undefined, notificationReadDto),
    getGoal: handler((req) => dailyGoalService.getGoal(req.user.id), undefined, goalDto),
    updateGoal: handler((req) => dailyGoalService.updateGoal(req.user.id, req.body), undefined, goalUpdateDto),
    updateReminderPreference: handler((req) => dailyGoalService.updateReminderPreference(req.user.id, req.body), undefined, reminderPreferenceDto),
    establishMonitor: handler((req) => dailyGoalService.establishMonitor(req.user.id, req.body), (data) => data.replayed ? 200 : 201, monitorEstablishDto),
    checkMonitor: handler((req) => dailyGoalService.checkMonitor(req.user.id, req.params.id, req.body), undefined, monitorCheckDto),
    closeMonitor: handler((req) => dailyGoalService.closeMonitor(req.user.id, req.params.id, req.body), undefined, monitorCloseDto),
    establish: handler((req) => dailyGoalService.establish(req.user.id, req.body), (data) => data.replayed ? 200 : 201, establishDto),
    engage: handler((req) => dailyGoalService.engage(req.user.id, req.params.id, req.body), undefined, engagementDto),
    heartbeat: handler((req) => dailyGoalService.heartbeat(req.user.id, req.params.id, req.body), undefined, heartbeatDto),
    pause: handler((req) => dailyGoalService.pause(req.user.id, req.params.id, req.body), undefined, endDto),
    close: handler((req) => dailyGoalService.close(req.user.id, req.params.id, req.body), undefined, endDto),
  });
}
function notificationDto(data) { return pick(data, ["id", "type", "title", "body", "application_date", "created_at", "read_at"]); }
function notificationListDto(data) { return { items: data.items.map(notificationDto), unread_count: data.unread_count, next_cursor: data.next_cursor }; }
function unreadCountDto(data) { return pick(data, ["unread_count"]); }
function notificationReadDto(data) { return { ...notificationDto(data.notification), unread_count: data.unread_count }; }
function goalDto(data) { return pick(data, ["application_date", "target_minutes", "active_seconds", "actual_minutes", "completed", "reward_earned", "reminder_enabled", "xp_level"]); }
function goalUpdateDto(data) { return { ...goalDto(data), reward: pick(data.reward, ["earned_now", "xp_earned"]) }; }
function reminderPreferenceDto(data) { return pick(data, ["reminder_enabled", "updated_at"]); }
function monitorEstablishDto(data) { return pick(data, ["monitor_session_id", "reminder_enabled", "target_configured", "unread_count", "check_after_seconds"]); }
function monitorCheckDto(data) { return pick(data, ["reminder_created", "unread_count", "next_check_after_seconds"]); }
function monitorCloseDto(data) { return pick(data, ["monitor_session_id", "closed_at"]); }
function handler(action, status = () => 200, serialize = (data) => data) { return async (req, res, next) => { try { const result = await action(req); res.status(status(result)).json({ success: true, data: serialize(result) }); } catch (error) { const statusCode = statusByCode(error?.code); if (!statusCode) return next(error); res.status(statusCode).json({ success: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }); } }; }
function establishDto(data) { return pick(data, ["tracking_session_id", "status", "owner", "generation", "projection"]); }
function engagementDto(data) { return pick(data, ["tracking_session_id", "status", "owner", "generation", "lease_expires_at", "engagement_expires_at", "projection"]); }
function heartbeatDto(data) { return pick(data, ["tracking_session_id", "status", "owner", "generation", "lease_expires_at", "engagement_expires_at", "credited_milliseconds", "projection"]); }
function endDto(data) { return pick(data, ["status", "owner", "projection"]); }
function pick(data, fields) { return Object.fromEntries(fields.map((field) => [field, data[field]])); }
function statusByCode(code) { if (["DAILY_GOAL_VALIDATION_ERROR", "VALIDATION_ERROR"].includes(code)) return 400; if (["DAILY_GOAL_NOT_FOUND", "NOT_FOUND"].includes(code)) return 404; if (["OPERATION_CONFLICT", "TRACKING_OWNERSHIP_CONFLICT", "TRACKING_SEQUENCE_CONFLICT", "IDLE_RESUME_REQUIRED"].includes(code)) return 409; return null; }
