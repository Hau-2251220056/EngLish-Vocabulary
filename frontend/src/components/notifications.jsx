import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ROUTINE_DURATION = 3500;

export function NotificationCenter() {
  return (
    <ToastContainer
      autoClose={ROUTINE_DURATION}
      className="elvocab-toast-container"
      closeOnClick={false}
      newestOnTop
      pauseOnFocusLoss
      pauseOnHover
      position="top-right"
      progressClassName="elvocab-toast-progress"
      role="alert"
      toastClassName="elvocab-toast"
    />
  );
}
