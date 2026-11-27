import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/auth-service.js";
import { useAuthentication } from "../use-authentication.js";

const GOOGLE_SDK_URL = "https://accounts.google.com/gsi/client";
let sdkPromise;

export function GoogleAuthenticationControl({ buttonText, disabled = false, onBusyChange, onAuthenticationStart }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuthentication();
  const buttonId = useId().replaceAll(":", "");
  const buttonRef = useRef(null);
  const mountedRef = useRef(true);
  const initializedAttemptRef = useRef(-1);
  const [status, setStatus] = useState(clientId ? "loading" : "unavailable");
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;
    if (initializedAttemptRef.current === attempt) return undefined;
    initializedAttemptRef.current = attempt;
    void Promise.all([authService.createGoogleChallenge(), loadGoogleSdk()])
      .then(([challenge]) => {
        if (!mountedRef.current || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce: challenge.nonce,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: async ({ credential }) => {
            if (!credential || !mountedRef.current) return;
            onAuthenticationStart?.();
            onBusyChange?.(true);
            setStatus("authenticating");
            setError(null);
            try {
              await loginWithGoogle(credential);
              navigate("/dashboard");
            } catch (authenticationError) {
              if (!mountedRef.current) return;
              setStatus("ready");
              setError(messageFor(authenticationError));
            } finally {
              if (mountedRef.current) onBusyChange?.(false);
            }
          },
        });
        buttonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: buttonText,
          shape: "rectangular",
          logo_alignment: "center",
          width: Math.min(400, Math.max(240, buttonRef.current.clientWidth)),
          locale: "vi",
        });
        setStatus("ready");
      })
      .catch(() => {
        if (mountedRef.current) {
          setStatus("unavailable");
          setError("Google hiện không khả dụng. Bạn vẫn có thể dùng email và mật khẩu.");
        }
      });
    return undefined;
  }, [attempt, buttonText, clientId, loginWithGoogle, navigate, onAuthenticationStart, onBusyChange]);

  if (!clientId) return null;

  return (
    <div className="mt-4" data-testid="google-authentication-control">
      <div className="mb-4 flex items-center gap-3 text-xs font-medium text-slate-400" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        <span>Hoặc</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="relative min-h-11 w-full overflow-hidden rounded" aria-busy={status === "loading" || status === "authenticating"}>
        <div
          id={buttonId}
          ref={buttonRef}
          className={`flex min-h-11 w-full justify-center${disabled || status === "authenticating" ? " pointer-events-none opacity-60" : ""}`}
          aria-hidden={disabled || status !== "ready" || undefined}
        />
        {status === "loading" || status === "authenticating" ? (
          <div className="absolute inset-0 flex min-h-11 items-center justify-center gap-2 rounded border border-slate-200 bg-white text-sm text-slate-600" role="status">
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {status === "authenticating" ? "Đang xác minh Google…" : "Đang tải Google…"}
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm leading-5 text-red-700" role="alert">{error}</p> : null}
      {status === "unavailable" && clientId ? (
        <button type="button" className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-semibold text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300" onClick={() => { setStatus("loading"); setError(null); setAttempt((value) => value + 1); }}>
          <RotateCcw className="size-4" aria-hidden="true" />Thử tải lại Google
        </button>
      ) : null}
    </div>
  );
}

function loadGoogleSdk() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_SDK_URL}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => window.google?.accounts?.id ? resolve() : reject(new Error("GIS unavailable")), { once: true });
    script.addEventListener("error", reject, { once: true });
    if (!existing) {
      script.src = GOOGLE_SDK_URL;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
  }).catch((error) => { sdkPromise = undefined; throw error; });
  return sdkPromise;
}

function messageFor(error) {
  if (error?.code === "GOOGLE_ACCOUNT_LINK_REQUIRED") {
    return "Email này đã có tài khoản ELVocab. Vui lòng đăng nhập bằng email và mật khẩu.";
  }
  return "Không thể đăng nhập bằng Google. Vui lòng thử lại hoặc dùng email và mật khẩu.";
}
