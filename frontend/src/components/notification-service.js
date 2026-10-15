import { toast } from "react-toastify";

const ROUTINE_DURATION = 3500;
const ERROR_DURATION = 7000;

export const notifications = {
  success(message, id) { return toast.success(message, options(id, ROUTINE_DURATION)); },
  warning(message, id) { return toast.warning(message, options(id, 5000)); },
  error(message, id) { return toast.error(message, options(id, ERROR_DURATION)); },
};

function options(toastId, autoClose) {
  return { autoClose, toastId };
}
