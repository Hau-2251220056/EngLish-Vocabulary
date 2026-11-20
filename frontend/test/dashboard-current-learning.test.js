import assert from "node:assert/strict";
import test from "node:test";
import { getCurrentLearningPresentation } from "../src/dashboard/dashboard-current-learning.js";

test("current learning presents concise backend-owned continuation states", () => {
  assert.deepEqual(getCurrentLearningPresentation(activePass("PRISTINE")), {
    isValid: true, status: "Tiếp tục lượt học hiện tại",
  });
  assert.deepEqual(getCurrentLearningPresentation(activePass("IN_PROGRESS")), {
    isValid: true, status: "Tiếp tục những từ còn lại",
  });
  assert.deepEqual(getCurrentLearningPresentation(activePass("READY_TO_COMPLETE")), {
    isValid: true, status: "Sẵn sàng hoàn thành bộ từ",
  });
});

test("current learning keeps restart-required separate from ordinary continuation", () => {
  assert.deepEqual(getCurrentLearningPresentation({
    ...activePass("IN_PROGRESS"), can_continue: false, restart_reason: "SNAPSHOT_CHANGED",
  }), { isValid: true, status: "Cần xác nhận bắt đầu lại" });
});

test("current learning rejects completed, invalidated and malformed pass projections", () => {
  for (const pass of [
    { ...activePass("READY_TO_COMPLETE"), state: "COMPLETED" },
    { ...activePass("IN_PROGRESS"), state: "INVALIDATED" },
    { ...activePass("PRISTINE"), snapshot_size: 0 },
    { ...activePass("PRISTINE"), ready_to_complete: true },
    { ...activePass("UNKNOWN"), activity_state: "UNKNOWN" },
    null,
  ]) {
    assert.deepEqual(getCurrentLearningPresentation(pass), { isValid: false, status: null });
  }
});

function activePass(activityState) {
  return {
    state: "ACTIVE",
    snapshot_size: 10,
    activity_state: activityState,
    ready_to_complete: activityState === "READY_TO_COMPLETE",
    can_continue: true,
  };
}
