import { toast } from "react-toastify";

const ROUTINE_DURATION = 3500;
const ERROR_DURATION = 7000;

export const notifications = {
  success(message, id, overrides) {
    return toast.success(message, options(id, ROUTINE_DURATION, overrides));
  },
  warning(message, id, overrides) {
    return toast.warning(message, options(id, 5000, overrides));
  },
  error(message, id, overrides) {
    return toast.error(message, options(id, ERROR_DURATION, overrides));
  },
};

function options(toastId, autoClose, overrides = {}) {
  return { ...overrides, autoClose, toastId };
}
