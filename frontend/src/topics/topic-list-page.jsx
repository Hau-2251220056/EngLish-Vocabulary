import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { topicService } from "../services/topic-service.js";

export function TopicListPage() {
  const [topics, setTopics] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let current = true;
    topicService.listTopics().then(
      (data) => {
        if (!current) return;
        setTopics(data);
        setStatus("success");
      },
      () => {
        if (current) setStatus("error");
      },
    );
    return () => {
      current = false;
    };
  }, [reloadToken]);

  function retry() {
    setStatus("loading");
    setReloadToken((value) => value + 1);
  }

  const visibleTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return topics;
    return topics.filter((topic) =>
      [topic.name, topic.description]
        .filter((value) => typeof value === "string")
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [query, topics]);

  return (
    <section className="public-topic-content" aria-labelledby="topic-list-title">
      <div className="public-topic-intro">
        <p className="public-topic-eyebrow">Khám phá từ vựng</p>
        <h1 id="topic-list-title">Chủ đề tiếng Anh</h1>
        <p>Tìm một chủ đề phù hợp với điều bạn muốn học hôm nay.</p>
      </div>

      {status === "success" && topics.length > 0 ? (
        <div className="public-topic-search">
          <label htmlFor="topic-search">Tìm kiếm chủ đề</label>
          <div className="public-topic-search-control">
            <Search className="size-5" aria-hidden="true" />
            <input
              id="topic-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nhập tên hoặc mô tả chủ đề"
              autoComplete="off"
            />
          </div>
          <p className="public-topic-result-count" aria-live="polite">
            {visibleTopics.length} chủ đề phù hợp
          </p>
        </div>
      ) : null}

      {status === "loading" ? <LoadingState message="Đang tải chủ đề…" /> : null}
      {status === "error" ? (
        <MessageState
          role="alert"
          title="Không thể tải danh sách chủ đề"
          message="Vui lòng kiểm tra kết nối và thử lại."
          action={<button type="button" onClick={retry}>Thử lại</button>}
        />
      ) : null}
      {status === "success" && topics.length === 0 ? (
        <MessageState
          title="Chưa có chủ đề"
          message="Danh sách chủ đề hiện đang trống."
        />
      ) : null}
      {status === "success" && topics.length > 0 && visibleTopics.length === 0 ? (
        <MessageState
          title="Không tìm thấy chủ đề phù hợp"
          message="Hãy thử một từ khóa khác."
        />
      ) : null}
      {status === "success" && visibleTopics.length > 0 ? (
        <ul className="public-topic-grid" aria-label="Danh sách chủ đề">
          {visibleTopics.map((topic) => (
            <li key={topic.id}>
              <article className="public-topic-card">
                <h2>{topic.name}</h2>
                <p>{topic.description || "Chưa có mô tả cho chủ đề này."}</p>
                <Link to={`/topics/${topic.id}`}>
                  Xem chi tiết
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function LoadingState({ message }) {
  return (
    <div className="public-topic-state" role="status" aria-live="polite">
      <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function MessageState({ action, message, role, title }) {
  return (
    <div className="public-topic-state" role={role}>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  );
}
