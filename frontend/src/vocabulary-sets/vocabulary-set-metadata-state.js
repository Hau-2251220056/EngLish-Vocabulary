export function initialMetadataValue(aggregate) {
  return {
    cefrLevel: aggregate.cefr_level ?? "",
    coverUrl: aggregate.cover_image_url ?? "",
    persistedCoverUrl: aggregate.cover_image_url ?? null,
    coverUrlDirty: false,
    isExisting: Boolean(aggregate.id),
    coverFile: null,
    removeCover: false,
  };
}

export function validateMetadata(value, { requiredCefr }) {
  if (requiredCefr && !value.cefrLevel) return "Hãy chọn trình độ CEFR.";
  if (value.coverFile && value.coverFile.size > 5 * 1024 * 1024) return "Ảnh bìa không được vượt quá 5 MiB.";
  if (value.coverUrl) {
    try {
      if (new URL(value.coverUrl).protocol !== "https:") return "URL ảnh bìa phải sử dụng HTTPS.";
    } catch { return "URL ảnh bìa không hợp lệ."; }
  }
  return null;
}
