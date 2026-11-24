import { toast } from "react-toastify";
import { notifications } from "../components/notification-service.js";
import "./admin-notifications.css";

const MAX_ADMIN_TOASTS = 3;
const activeIds = [];

export const adminNotifications = {
  success(message, id) {
    return show("success", message, id);
  },
  error(message, id) {
    return show("error", message, id);
  },
};

function show(type, message, id) {
  const toastId = `admin-${id}`;
  if (toast.isActive(toastId)) return toastId;
  activeIds.push(toastId);
  while (activeIds.length > MAX_ADMIN_TOASTS) toast.dismiss(activeIds.shift());
  return notifications[type](message, toastId, {
    className: `admin-toast is-${type}`,
    onClose: () => removeActive(toastId),
  });
}

function removeActive(id) {
  const index = activeIds.indexOf(id);
  if (index >= 0) activeIds.splice(index, 1);
}
