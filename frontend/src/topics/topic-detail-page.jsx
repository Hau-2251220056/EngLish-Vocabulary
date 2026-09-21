import { ArrowLeft, CalendarDays, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { TopicApiError, topicService } from "../services/topic-service.js";

export function TopicDetailPage() {
  const { topicId } = useParams();
  return <TopicDetailContent key={topicId} topicId={topicId} />;
}

function TopicDetailContent({ topicId }) {
  const [topic, setTopic] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let current = true;
    topicService.getTopic(topicId).then(
      (data) => {
        if (!current) return;
        setTopic(data);
        setStatus("success");
      },
      (error) => {
        if (!current) return;
        setStatus(
          error instanceof TopicApiError && error.kind === "not-found"
            ? "not-found"
            : "error",
        );
      },
    );
    return () => {
      current = false;
    };
  }, [reloadToken, topicId]);

  function retry() {
    setStatus("loading");
    setReloadToken((value) => value + 1);
  }

  return (
    <section className="public-topic-content" aria-label="Chi tiết chủ đề">
      <Link className="public-topic-back-link" to="/topics">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tất cả chủ đề
      </Link>

      {status === "loading" ? (
        <div className="public-topic-state" role="status" aria-live="polite">
          <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
          <p>Đang tải chủ đề…</p>
        </div>
      ) : null}
      {status === "not-found" ? (
        <div className="public-topic-state" role="alert">
          <h1 id="topic-detail-title">Không tìm thấy chủ đề</h1>
          <p>Chủ đề này không tồn tại hoặc không còn khả dụng.</p>
          <Link to="/topics">Quay lại danh sách chủ đề</Link>
        </div>
      ) : null}
      {status === "error" ? (
        <div className="public-topic-state" role="alert">
          <h1 id="topic-detail-title">Không thể tải chủ đề</h1>
          <p>Vui lòng kiểm tra kết nối và thử lại.</p>
          <button type="button" onClick={retry}>Thử lại</button>
        </div>
      ) : null}
      {status === "success" && topic ? (
        <article className="public-topic-detail-card">
          <p className="public-topic-eyebrow">Chi tiết chủ đề</p>
          <h1 id="topic-detail-title">{topic.name}</h1>
          <p className="public-topic-detail-description">
            {topic.description || "Chưa có mô tả cho chủ đề này."}
          </p>
          <dl className="public-topic-metadata">
            <div>
              <dt><CalendarDays className="size-4" aria-hidden="true" />Ngày tạo</dt>
              <dd>{formatDate(topic.created_at)}</dd>
            </div>
            <div>
              <dt><CalendarDays className="size-4" aria-hidden="true" />Cập nhật</dt>
              <dd>{formatDate(topic.updated_at)}</dd>
            </div>
          </dl>
        </article>
      ) : null}
    </section>
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "long",
  }).format(date);
}
