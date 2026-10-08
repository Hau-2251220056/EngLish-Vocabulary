import { BookOpen } from "lucide-react";
import { useState } from "react";

export function SetCover({ alt = "", children, className = "", coverImageUrl, fallback, imageClassName = "" }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const hasCover = typeof coverImageUrl === "string" && coverImageUrl.length > 0 && failedUrl !== coverImageUrl;

  return (
    <div className={className} data-cover-state={hasCover ? "persisted" : "fallback"}>
      {hasCover ? (
        <img
          alt={alt}
          className={imageClassName}
          src={coverImageUrl}
          onError={() => setFailedUrl(coverImageUrl)}
        />
      ) : fallback}
      {children}
    </div>
  );
}

export function SetCefrBadge({ cefrLevel }) {
  if (!cefrLevel) return null;
  return <span className="set-cefr-badge inline-flex min-h-6 items-center rounded-full bg-[#eef5ff] px-2 py-0.5 text-xs font-semibold text-[#276b9f] ring-1 ring-inset ring-[#cfe3f5]">{cefrLevel}</span>;
}

export function DefaultSetCoverArtwork() {
  return <BookOpen aria-hidden="true" />;
}
