const TEST_PREFIX = "TEST_";
const CONFIG_NAMES = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_VOCABULARY_SET_COVERS_BUCKET",
  "SUPABASE_STORAGE_NAMESPACE",
];

export function readVocabularySetCoverStorageConfig({ env = process.env, test = false } = {}) {
  const values = Object.fromEntries(CONFIG_NAMES.map((name) => {
    const key = test ? `${TEST_PREFIX}${name}` : name;
    return [name, env[key]];
  }));
  if (Object.values(values).some((value) => typeof value !== "string" || value.trim().length === 0)) {
    throw storageUnavailableError();
  }
  let url;
  try {
    url = new URL(values.SUPABASE_URL);
  } catch {
    throw storageUnavailableError();
  }
  if (url.protocol !== "https:" || !isSafeSegment(values.SUPABASE_VOCABULARY_SET_COVERS_BUCKET)
    || !isSafeSegment(values.SUPABASE_STORAGE_NAMESPACE)) {
    throw storageUnavailableError();
  }
  if (test) {
    const bucket = values.SUPABASE_VOCABULARY_SET_COVERS_BUCKET.toLowerCase();
    const namespace = values.SUPABASE_STORAGE_NAMESPACE.toLowerCase();
    if (!bucket.includes("test") || !namespace.includes("test")) throw storageUnavailableError();
    for (const name of CONFIG_NAMES) {
      if (env[name] && env[name] === values[name]) throw storageUnavailableError();
    }
  }
  return Object.freeze({
    url: values.SUPABASE_URL,
    serviceRoleKey: values.SUPABASE_SERVICE_ROLE_KEY,
    bucket: values.SUPABASE_VOCABULARY_SET_COVERS_BUCKET,
    namespace: values.SUPABASE_STORAGE_NAMESPACE,
  });
}

function isSafeSegment(value) {
  return /^[a-z0-9][a-z0-9_-]{0,62}$/i.test(value);
}

function storageUnavailableError() {
  return Object.assign(new Error("Cover storage is unavailable."), {
    code: "COVER_STORAGE_UNAVAILABLE",
  });
}
