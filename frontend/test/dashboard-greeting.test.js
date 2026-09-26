import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardGreeting } from "../src/dashboard/dashboard-greeting.js";

const atHour = (hour) => ({ getHours: () => hour });

test("Dashboard greeting follows every approved local-time boundary", () => {
  const cases = [
    [4, "Chào buổi tối"],
    [5, "Chào buổi sáng"],
    [10, "Chào buổi sáng"],
    [11, "Chào buổi trưa"],
    [13, "Chào buổi trưa"],
    [14, "Chào buổi chiều"],
    [17, "Chào buổi chiều"],
    [18, "Chào buổi tối"],
    [23, "Chào buổi tối"],
    [0, "Chào buổi tối"],
  ];

  for (const [hour, expected] of cases) {
    assert.equal(getDashboardGreeting(atHour(hour)), expected, `hour ${hour}`);
  }
});
