const ACTIVE_STATES = new Set(["PRISTINE", "IN_PROGRESS", "READY_TO_COMPLETE"]);

export function getCurrentLearningPresentation(pass) {
  const isValid = pass?.state === "ACTIVE"
    && Number.isSafeInteger(pass.snapshot_size) && pass.snapshot_size > 0
    && ACTIVE_STATES.has(pass.activity_state)
    && typeof pass.ready_to_complete === "boolean"
    && pass.ready_to_complete === (pass.activity_state === "READY_TO_COMPLETE");
  if (!isValid) return { isValid: false, status: null };
  if (pass.can_continue === false) {
    return { isValid: true, status: "Cần xác nhận bắt đầu lại" };
  }
  if (pass.ready_to_complete) {
    return { isValid: true, status: "Sẵn sàng hoàn thành bộ từ" };
  }
  return {
    isValid: true,
    status: pass.activity_state === "IN_PROGRESS"
      ? "Tiếp tục những từ còn lại"
      : "Tiếp tục lượt học hiện tại",
  };
}
