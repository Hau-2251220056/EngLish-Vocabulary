import multer from "multer";
import { MAX_COVER_INPUT_BYTES } from "../images/vocabulary-set-cover-image-processor.js";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export function createVocabularySetCoverUploadMiddleware() {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_COVER_INPUT_BYTES, files: 1, fields: 0, parts: 1, headerPairs: 50 },
    fileFilter(_req, file, callback) {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return callback(Object.assign(new Error("Unsupported cover media type."), {
          code: "UNSUPPORTED_COVER_MEDIA_TYPE",
        }));
      }
      callback(null, true);
    },
  }).single("cover");

  return (req, res, next) => parser(req, res, (error) => {
    if (!error) {
      if (!req.file || Object.keys(req.body ?? {}).length > 0) return sendError(res, 400, "VALIDATION_ERROR", "Cover upload is invalid.");
      return next();
    }
    if (error.code === "LIMIT_FILE_SIZE") return sendError(res, 413, "COVER_FILE_TOO_LARGE", "Cover file is too large.");
    if (error.code === "UNSUPPORTED_COVER_MEDIA_TYPE") return sendError(res, 415, error.code, error.message);
    return sendError(res, 400, "VALIDATION_ERROR", "Cover upload is invalid.");
  });
}

function sendError(res, status, code, message) {
  res.status(status).json({ success: false, error: { code, message } });
}
