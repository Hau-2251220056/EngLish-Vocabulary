import {
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TopicApiError, topicService } from "../services/topic-service.js";

export function AdminTopicPage() {
  const [topics, setTopics] = useState([]);
  const [query, setQuery] = useState("");
  const [loadStatus, setLoadStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [formState, setFormState] = useState(null);
  const [topicToDelete, setTopicToDelete] = useState(null);
  const [mutation, setMutation] = useState({ status: "idle", message: null });
  const deleteTriggerRef = useRef(null);

  useEffect(() => {
    let current = true;
    topicService.listTopics().then(
      (data) => {
        if (!current) return;
        setTopics(data);
        setLoadStatus("success");
      },
      () => {
        if (current) setLoadStatus("error");
      },
    );
    return () => {
      current = false;
    };
  }, [reloadToken]);

  const visibleTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return topics;
    return topics.filter((topic) =>
      [topic.name, topic.description]
        .filter((value) => typeof value === "string")
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [query, topics]);

  function retryLoad() {
    setLoadStatus("loading");
    setReloadToken((value) => value + 1);
  }

  function openCreate() {
    setFormState({ mode: "create", topic: null });
    setSelectedTopic(null);
    setMutation({ status: "idle", message: null });
  }

  function openEdit(topic) {
    setFormState({ mode: "edit", topic });
    setSelectedTopic(null);
    setMutation({ status: "idle", message: null });
  }

  function openView(topic) {
    setSelectedTopic(topic);
    setFormState(null);
    setMutation({ status: "idle", message: null });
  }

  async function submitForm(values) {
    const mode = formState.mode;
    setMutation({ status: "pending", message: null });
    try {
      const topic =
        mode === "create"
          ? await topicService.createTopic(values)
          : await topicService.updateTopic(formState.topic.id, values);

      setTopics((current) =>
        mode === "create"
          ? [...current, topic]
          : current.map((item) => (item.id === topic.id ? topic : item)),
      );
      setFormState(null);
      setSelectedTopic(topic);
      setMutation({
        status: "success",
        message:
          mode === "create"
            ? "Đã tạo chủ đề thành công."
            : "Đã cập nhật chủ đề thành công.",
      });
    } catch (error) {
      setMutation({ status: "error", message: mutationErrorMessage(error) });
      if (error instanceof TopicApiError && error.code === "TOPIC_NOT_FOUND") {
        retryLoad();
      }
    }
  }

  function requestDelete(topic, trigger) {
    deleteTriggerRef.current = trigger;
    setTopicToDelete(topic);
    setMutation({ status: "idle", message: null });
  }

  function closeDeleteDialog() {
    setTopicToDelete(null);
    requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  }

  async function confirmDelete() {
    if (!topicToDelete || mutation.status === "pending") return;
    setMutation({ status: "pending", message: null });
    try {
      await topicService.deleteTopic(topicToDelete.id);
      setTopics((current) =>
        current.filter((topic) => topic.id !== topicToDelete.id),
      );
      if (selectedTopic?.id === topicToDelete.id) setSelectedTopic(null);
      closeDeleteDialog();
      setMutation({ status: "success", message: "Đã xóa chủ đề thành công." });
    } catch (error) {
      setMutation({ status: "error", message: mutationErrorMessage(error) });
    }
  }

  return (
    <section className="admin-topic-page" aria-labelledby="admin-topic-title">
      <header className="admin-topic-page-header">
        <div>
          <p className="admin-topic-eyebrow">Quản trị nội dung</p>
          <h1 id="admin-topic-title">Quản lý chủ đề</h1>
          <p>Tạo và duy trì danh mục chủ đề học tập của ELVocab.</p>
        </div>
        <button
          className="admin-topic-primary-button"
          type="button"
          onClick={openCreate}
          disabled={mutation.status === "pending"}
        >
          <Plus className="size-5" aria-hidden="true" />
          Tạo chủ đề
        </button>
      </header>

      {mutation.message ? (
        <p
          className={`admin-topic-feedback is-${mutation.status}`}
          role={mutation.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {mutation.message}
        </p>
      ) : null}

      {formState ? (
        <TopicForm
          key={`${formState.mode}-${formState.topic?.id ?? "new"}`}
          mode={formState.mode}
          topic={formState.topic}
          pending={mutation.status === "pending"}
          onCancel={() => {
            setFormState(null);
            setMutation({ status: "idle", message: null });
          }}
          onSubmit={submitForm}
        />
      ) : null}

      {selectedTopic ? (
        <TopicDetails
          topic={selectedTopic}
          onClose={() => setSelectedTopic(null)}
        />
      ) : null}

      <div className="admin-topic-toolbar">
        <div className="admin-topic-search">
          <label htmlFor="admin-topic-search">Tìm kiếm chủ đề</label>
          <div>
            <Search className="size-5" aria-hidden="true" />
            <input
              id="admin-topic-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tên hoặc mô tả"
              autoComplete="off"
            />
          </div>
        </div>
        {loadStatus === "success" ? (
          <p aria-live="polite">{visibleTopics.length} chủ đề</p>
        ) : null}
      </div>

      {loadStatus === "loading" ? (
        <AdminState loading message="Đang tải danh sách chủ đề…" />
      ) : null}
      {loadStatus === "error" ? (
        <AdminState
          title="Không thể tải chủ đề"
          message="Vui lòng thử lại."
          action={
            <button type="button" onClick={retryLoad}>
              Thử lại
            </button>
          }
        />
      ) : null}
      {loadStatus === "success" && topics.length === 0 ? (
        <AdminState
          title="Chưa có chủ đề"
          message="Tạo chủ đề đầu tiên để bắt đầu."
        />
      ) : null}
      {loadStatus === "success" &&
      topics.length > 0 &&
      visibleTopics.length === 0 ? (
        <AdminState
          title="Không có kết quả"
          message="Hãy thử từ khóa khác."
        />
      ) : null}
      {loadStatus === "success" && visibleTopics.length > 0 ? (
        <TopicTable
          topics={visibleTopics}
          pending={mutation.status === "pending"}
          onView={openView}
          onEdit={openEdit}
          onDelete={requestDelete}
        />
      ) : null}

      {topicToDelete ? (
        <DeleteTopicDialog
          topic={topicToDelete}
          pending={mutation.status === "pending"}
          error={mutation.status === "error" ? mutation.message : null}
          onCancel={closeDeleteDialog}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  );
}

function TopicTable({ onDelete, onEdit, onView, pending, topics }) {
  return (
    <div className="admin-topic-table-wrap">
      <table className="admin-topic-table">
        <caption className="sr-only">Danh sách chủ đề hệ thống</caption>
        <thead>
          <tr>
            <th scope="col">Tên</th>
            <th scope="col">Mô tả</th>
            <th scope="col"><span className="sr-only">Hành động</span></th>
          </tr>
        </thead>
        <tbody>
          {topics.map((topic) => (
            <tr key={topic.id}>
              <th scope="row">{topic.name}</th>
              <td>{topic.description || "Chưa có mô tả"}</td>
              <td>
                <div className="admin-topic-actions">
                  <button type="button" disabled={pending} onClick={() => onView(topic)} aria-label={`Xem ${topic.name}`}><Eye className="size-4" aria-hidden="true" /></button>
                  <button type="button" disabled={pending} onClick={() => onEdit(topic)} aria-label={`Sửa ${topic.name}`}><Pencil className="size-4" aria-hidden="true" /></button>
                  <button type="button" disabled={pending} className="is-danger" onClick={(event) => onDelete(topic, event.currentTarget)} aria-label={`Xóa ${topic.name}`}><Trash2 className="size-4" aria-hidden="true" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopicForm({ mode, onCancel, onSubmit, pending, topic }) {
  const [values, setValues] = useState({
    name: topic?.name ?? "",
    description: topic?.description ?? "",
  });
  const [errors, setErrors] = useState({});

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateTopic(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const name = values.name.trim();
    const description = values.description === "" ? null : values.description;
    if (mode === "create") {
      void onSubmit({ name, description });
      return;
    }

    const changes = {};
    if (name !== topic.name) changes.name = name;
    if (description !== topic.description) changes.description = description;
    if (Object.keys(changes).length === 0) {
      setErrors({ form: "Chưa có thay đổi để lưu." });
      return;
    }
    void onSubmit(changes);
  }

  return (
    <section className="admin-topic-panel" aria-labelledby="topic-form-title">
      <div className="admin-topic-panel-heading">
        <h2 id="topic-form-title">
          {mode === "create" ? "Tạo chủ đề" : `Chỉnh sửa ${topic.name}`}
        </h2>
        <button type="button" onClick={onCancel} disabled={pending} aria-label="Đóng biểu mẫu"><X className="size-5" aria-hidden="true" /></button>
      </div>
      <form className="admin-topic-form" onSubmit={handleSubmit} noValidate>
        {errors.form ? <p className="admin-topic-field-error" role="alert">{errors.form}</p> : null}
        <div>
          <label htmlFor="topic-name">Tên chủ đề</label>
          <input id="topic-name" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} maxLength={101} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "topic-name-error" : undefined} disabled={pending} />
          {errors.name ? <p id="topic-name-error" className="admin-topic-field-error">{errors.name}</p> : null}
        </div>
        <div>
          <label htmlFor="topic-description">Mô tả <span>(không bắt buộc)</span></label>
          <textarea id="topic-description" value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} maxLength={501} rows={4} aria-invalid={Boolean(errors.description)} aria-describedby="topic-description-help" disabled={pending} />
          <p id="topic-description-help" className={errors.description ? "admin-topic-field-error" : "admin-topic-field-help"}>{errors.description ?? `${values.description.length}/500 ký tự`}</p>
        </div>
        <div className="admin-topic-form-actions">
          <button type="button" onClick={onCancel} disabled={pending}>Hủy</button>
          <button className="admin-topic-primary-button" type="submit" disabled={pending} aria-busy={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}{pending ? "Đang lưu…" : "Lưu chủ đề"}</button>
        </div>
      </form>
    </section>
  );
}

function TopicDetails({ onClose, topic }) {
  return (
    <section className="admin-topic-panel" aria-labelledby="admin-topic-detail-title">
      <div className="admin-topic-panel-heading">
        <h2 id="admin-topic-detail-title">{topic.name}</h2>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết"><X className="size-5" aria-hidden="true" /></button>
      </div>
      <p className="admin-topic-detail-description">{topic.description || "Chưa có mô tả cho chủ đề này."}</p>
      <dl className="admin-topic-detail-meta">
        <div><dt>Ngày tạo</dt><dd>{formatDate(topic.created_at)}</dd></div>
        <div><dt>Cập nhật</dt><dd>{formatDate(topic.updated_at)}</dd></div>
      </dl>
    </section>
  );
}

function DeleteTopicDialog({ error, onCancel, onConfirm, pending, topic }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="admin-topic-dialog"
      aria-labelledby="delete-topic-title"
      aria-describedby="delete-topic-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <h2 id="delete-topic-title">Xóa chủ đề?</h2>
      <p id="delete-topic-description">Bạn sẽ xóa <strong>{topic.name}</strong>. Hành động này không thể hoàn tác.</p>
      {error ? <p className="admin-topic-field-error" role="alert">{error}</p> : null}
      <div className="admin-topic-dialog-actions">
        <button type="button" onClick={onCancel} disabled={pending} autoFocus>Hủy</button>
        <button type="button" className="is-danger" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}{pending ? "Đang xóa…" : "Xác nhận xóa"}</button>
      </div>
    </dialog>
  );
}

function AdminState({ action, loading, message, title }) {
  return (
    <div className="admin-topic-state" role={loading ? "status" : undefined} aria-live={loading ? "polite" : undefined}>
      {loading ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : null}
      {title ? <h2>{title}</h2> : null}
      <p>{message}</p>
      {action}
    </div>
  );
}

function validateTopic(values) {
  const errors = {};
  const name = values.name.trim();
  if (!name) errors.name = "Tên chủ đề là bắt buộc.";
  else if (name.length > 100) errors.name = "Tên chủ đề không được quá 100 ký tự.";
  if (values.description.length > 500) errors.description = "Mô tả không được quá 500 ký tự.";
  return errors;
}

function mutationErrorMessage(error) {
  const messages = {
    TOPIC_NAME_ALREADY_EXISTS: "Tên chủ đề đã tồn tại.",
    TOPIC_NOT_FOUND: "Chủ đề không còn tồn tại.",
    VALIDATION_ERROR: "Dữ liệu chủ đề không hợp lệ.",
    AUTHENTICATION_FAILED: "Phiên đăng nhập không còn hợp lệ.",
    FORBIDDEN: "Bạn không có quyền thực hiện hành động này.",
  };
  return messages[error?.code] ?? (error?.kind === "operational" ? "Không thể kết nối dịch vụ chủ đề. Vui lòng thử lại." : "Không thể hoàn tất hành động. Vui lòng thử lại.");
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Không xác định"
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(date);
}
