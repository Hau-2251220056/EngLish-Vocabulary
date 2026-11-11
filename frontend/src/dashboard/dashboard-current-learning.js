export function calculateLearningPassProgress(pass) {
  const snapshotSize = Number.isSafeInteger(pass?.snapshot_size) && pass.snapshot_size > 0
    ? pass.snapshot_size
    : 0;
  const rawStudiedItems = Number.isSafeInteger(pass?.studied_items) ? pass.studied_items : 0;
  const studiedItems = snapshotSize > 0
    ? Math.min(snapshotSize, Math.max(0, rawStudiedItems))
    : 0;

  return {
    isValid: snapshotSize > 0,
    percentage: snapshotSize > 0 ? Math.round((studiedItems / snapshotSize) * 100) : 0,
    snapshotSize,
    studiedItems,
  };
}
