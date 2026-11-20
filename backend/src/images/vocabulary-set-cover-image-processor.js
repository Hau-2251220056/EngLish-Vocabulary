import sharp from "sharp";

export const MAX_COVER_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const OUTPUT_DIMENSION = 1600;
const MIME_BY_FORMAT = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export function createVocabularySetCoverImageProcessor({
  sharpFactory = sharp,
  maxConcurrent = 2,
  maxQueue = 8,
  deadlineMs = 15_000,
} = {}) {
  let active = 0;
  const queue = [];

  return { process: (input) => enqueue(() => processImage(input, sharpFactory), { maxConcurrent, maxQueue, deadlineMs, queue, getActive: () => active, setActive: (value) => { active = value; } }) };
}

async function processImage({ buffer, mimetype }, sharpFactory) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_COVER_INPUT_BYTES) {
    throw processingError(buffer?.length > MAX_COVER_INPUT_BYTES ? "COVER_FILE_TOO_LARGE" : "VALIDATION_ERROR");
  }
  const signatureFormat = detectFormat(buffer);
  if (!signatureFormat || MIME_BY_FORMAT[signatureFormat] !== mimetype) {
    throw processingError(signatureFormat ? "UNSUPPORTED_COVER_MEDIA_TYPE" : "UNSUPPORTED_COVER_MEDIA_TYPE");
  }
  try {
    const source = sharpFactory(buffer, { failOn: "error", limitInputPixels: MAX_DIMENSION * MAX_DIMENSION, animated: false });
    const metadata = await source.metadata();
    if (metadata.format !== signatureFormat || !metadata.width || !metadata.height
      || metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION || (metadata.pages ?? 1) !== 1) {
      throw processingError("VALIDATION_ERROR");
    }
    const output = await source.rotate().resize({
      width: OUTPUT_DIMENSION,
      height: OUTPUT_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    }).webp({ quality: 82 }).toBuffer();
    const result = await sharpFactory(output, { failOn: "error" }).metadata();
    return { buffer: output, mimetype: "image/webp", width: result.width, height: result.height };
  } catch (error) {
    if (error?.code) throw error;
    throw processingError("VALIDATION_ERROR");
  }
}

function enqueue(work, state) {
  if (state.getActive() >= state.maxConcurrent && state.queue.length >= state.maxQueue) {
    return Promise.reject(processingError("COVER_PROCESSING_BUSY"));
  }
  return new Promise((resolve, reject) => {
    state.queue.push({ work, resolve, reject });
    drain(state);
  });
}

function drain(state) {
  while (state.getActive() < state.maxConcurrent && state.queue.length > 0) {
    const entry = state.queue.shift();
    state.setActive(state.getActive() + 1);
    const work = Promise.resolve().then(entry.work);
    withDeadline(work, state.deadlineMs).then(entry.resolve, entry.reject);
    work.catch(() => {}).finally(() => {
        state.setActive(state.getActive() - 1);
        drain(state);
    });
  }
}

function withDeadline(promise, deadlineMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(processingError("COVER_PROCESSING_TIMEOUT")), deadlineMs);
      timer.unref?.();
    }),
  ]).finally(() => clearTimeout(timer));
}

function detectFormat(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

function processingError(code) {
  const messages = {
    COVER_FILE_TOO_LARGE: "Cover file is too large.",
    UNSUPPORTED_COVER_MEDIA_TYPE: "Cover image type is unsupported.",
    COVER_PROCESSING_BUSY: "Cover processing is busy.",
    COVER_PROCESSING_TIMEOUT: "Cover processing timed out.",
    VALIDATION_ERROR: "Cover image data is invalid.",
  };
  return Object.assign(new Error(messages[code]), { code });
}
