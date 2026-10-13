import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  bindSpeakingPracticeVisibility,
  createSpeakingPracticePageSession,
  mapLearningIssue,
  resolveSpeakingPracticeReturnTo,
  SPEAKING_PRACTICE_LOAD_ISSUES,
} from "../src/pronunciation/speaking-practice-page-session.js";
import {
  createSpeakingPracticeController,
  SPEAKING_PRACTICE_PHASES,
} from "../src/pronunciation/speaking-practice-state.js";

test("authorized NORMAL loads preserve exact Set and duplicate-spelling Vocabulary identity and order", async () => {
  for (const setId of ["public-set", "owned-private-set"]) {
    const calls = [];
    const { session } = createSession({
      setId,
      async loadLearningSet(requestedSetId, options) {
        calls.push([requestedSetId, options]);
        return learningSet(setId);
      },
    });

    const operation = await session.start();
    const snapshot = session.getSnapshot();

    assert.equal(operation.ok, true);
    assert.deepEqual(calls, [[setId, { mode: "NORMAL" }]]);
    assert.equal(snapshot.phase, SPEAKING_PRACTICE_PHASES.READY);
    assert.equal(snapshot.set.id, setId);
    assert.deepEqual(snapshot.targets.map(({ id, word, position }) => ({ id, word, position })), [
      { id: "vocabulary-2", word: "book", position: 2 },
      { id: "vocabulary-1", word: "book", position: 1 },
    ]);
    assert.equal(snapshot.target.id, "vocabulary-2");
    session.dispose();
  }
});

test("Learning failures map to stable inaccessible, empty, unauthenticated and recoverable states", async () => {
  const cases = [
    ["LEARNING_SET_NOT_FOUND", SPEAKING_PRACTICE_PHASES.INACCESSIBLE, "LEARNING_SET_NOT_FOUND"],
    ["FORBIDDEN", SPEAKING_PRACTICE_PHASES.INACCESSIBLE, "FORBIDDEN"],
    ["LEARNING_SET_EMPTY", SPEAKING_PRACTICE_PHASES.EMPTY, "LEARNING_SET_EMPTY"],
    ["AUTHENTICATION_FAILED", SPEAKING_PRACTICE_PHASES.INACCESSIBLE, "UNAUTHENTICATED"],
    ["INVALID_LEARNING_RESPONSE", SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR, "INVALID_LEARNING_RESPONSE"],
    ["SOMETHING_PRIVATE", SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR, "LEARNING_REQUEST_FAILED"],
  ];

  for (const [code, phase, issue] of cases) {
    const { session } = createSession({
      setId: "set-1",
      async loadLearningSet() { throw Object.assign(new Error("private detail"), { code }); },
    });
    await session.start();
    assert.equal(session.getSnapshot().phase, phase, code);
    assert.equal(session.getSnapshot().issue, issue, code);
    session.dispose();
  }
  assert.equal(mapLearningIssue({ status: 401 }), SPEAKING_PRACTICE_LOAD_ISSUES.UNAUTHENTICATED);
});

test("invalid route identity is rejected without issuing a Learning request", async () => {
  let calls = 0;
  const { session } = createSession({
    setId: " ",
    async loadLearningSet() { calls += 1; return learningSet("unused"); },
  });

  await session.start();

  assert.equal(calls, 0);
  assert.equal(session.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR);
  assert.equal(session.getSnapshot().issue, "INVALID_LEARNING_SET");
  session.dispose();
});

test("out-of-order completion cannot let the older load replace the newer generation", async () => {
  const requests = [];
  const { session } = createSession({
    setId: "set-1",
    loadLearningSet() {
      const pending = deferred();
      requests.push(pending);
      return pending.promise;
    },
  });

  const older = session.start();
  await Promise.resolve();
  const newer = session.start();
  await Promise.resolve();
  requests[1].resolve(learningSet("set-1", "newer"));
  await newer;
  requests[0].resolve(learningSet("set-1", "older"));
  await older;

  assert.equal(session.getSnapshot().set.name, "newer");
  session.dispose();
});

test("cleanup suppresses late HTTP completion and snapshot publication", async () => {
  const pending = deferred();
  const snapshots = [];
  const { session } = createSession({
    setId: "set-1",
    loadLearningSet: () => pending.promise,
    onSnapshot: (snapshot) => snapshots.push(snapshot),
  });
  const loading = session.start();
  await Promise.resolve();
  session.dispose();
  const countAfterDispose = snapshots.length;

  pending.resolve(learningSet("set-1"));
  await loading;

  assert.equal(session.getSnapshot().disposed, true);
  assert.equal(snapshots.length, countAfterDispose);
});

test("StrictMode-style cleanup and replay use independent controllers", async () => {
  const controllers = [];
  const first = createSession({ setId: "set-1", controllers, loadLearningSet: async () => learningSet("set-1", "first") }).session;
  const firstLoad = first.start();
  first.dispose();
  await firstLoad;
  const second = createSession({ setId: "set-1", controllers, loadLearningSet: async () => learningSet("set-1", "second") }).session;
  await second.start();

  assert.equal(controllers.length, 2);
  assert.notEqual(controllers[0], controllers[1]);
  assert.equal(controllers[0].getSnapshot().disposed, true);
  assert.equal(second.getSnapshot().set.name, "second");
  second.dispose();
});

test("retry after settlement issues a fresh NORMAL request", async () => {
  let calls = 0;
  const { session } = createSession({
    setId: "set-1",
    async loadLearningSet() {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("offline"), { code: "LEARNING_REQUEST_FAILED" });
      return learningSet("set-1");
    },
  });

  await session.start();
  assert.equal(session.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR);
  await session.retry();
  assert.equal(calls, 2);
  assert.equal(session.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.READY);
  session.dispose();
});

test("page load checks capability without constructing native SpeechRecognition", async () => {
  const { session, native } = createSession({
    setId: "set-1",
    loadLearningSet: async () => learningSet("set-1"),
  });

  await session.start();

  assert.equal(native.constructions, 0);
  assert.equal(session.getSnapshot().recognition.phase, "IDLE");
  session.dispose();
});

test("returnTo accepts only exact public or owned-private Set detail routes", () => {
  assert.equal(resolveSpeakingPracticeReturnTo("set-1", { returnTo: "/vocabulary-sets/set-1" }), "/vocabulary-sets/set-1");
  assert.equal(resolveSpeakingPracticeReturnTo("set-1", { returnTo: "/my/vocabulary-sets/set-1" }), "/my/vocabulary-sets/set-1");
  assert.equal(resolveSpeakingPracticeReturnTo("set-1", { returnTo: "/admin/vocabulary-sets" }), "/vocabulary-sets/set-1");
  assert.equal(resolveSpeakingPracticeReturnTo("set-1", { returnTo: "/my/vocabulary-sets/other" }), "/vocabulary-sets/set-1");
  assert.equal(resolveSpeakingPracticeReturnTo(" ", { returnTo: "/vocabulary-sets/ " }), "/topics");
});

test("Previous, Next and Skip preserve ordered exact Vocabulary identities", async () => {
  const { session, native } = createSession({
    setId: "set-1",
    loadLearningSet: async () => learningSet("set-1"),
  });
  await session.start();

  assert.equal(session.previousTarget().issue, "INVALID_TARGET");
  assert.equal(session.nextTarget().ok, true);
  assert.equal(session.getSnapshot().targetIndex, 1);
  assert.equal(session.getSnapshot().target.id, "vocabulary-1");
  assert.equal(session.getSnapshot().target.word, "book");
  assert.equal(session.previousTarget().ok, true);
  assert.equal(session.getSnapshot().target.id, "vocabulary-2");
  assert.equal(session.skipTarget().ok, true);
  assert.equal(session.getSnapshot().target.id, "vocabulary-1");
  assert.equal(native.constructions, 0);
  session.dispose();
});

test("Next and Skip beyond the final target enter completion only on explicit action", async () => {
  for (const command of ["nextTarget", "skipTarget"]) {
    const { session, native } = createSession({
      setId: "set-1",
      loadLearningSet: async () => singleLearningSet("set-1"),
    });
    await session.start();

    assert.equal(session.getSnapshot().completed, false);
    assert.equal(session[command]().ok, true);
    const completed = session.getSnapshot();
    assert.equal(completed.completed, true);
    assert.equal(completed.target.id, "vocabulary-only");
    assert.equal(completed.result, null);
    assert.equal(completed.controls.canListen, false);
    assert.equal(completed.controls.canSpeak, false);
    assert.equal(completed.controls.canChangeTarget, false);
    assert.equal(completed.controls.canRetry, false);
    assert.equal(completed.controls.canExit, true);
    assert.equal(native.constructions, 0);
    session.dispose();
  }
});

test("completion restart returns to the first server target without recognition or playback", async () => {
  const { session, native } = createSession({
    setId: "set-1",
    loadLearningSet: async () => learningSet("set-1"),
  });
  await session.start();
  session.nextTarget();
  session.nextTarget();

  assert.equal(session.restartAfterCompletion().ok, true);
  const restarted = session.getSnapshot();
  assert.equal(restarted.completed, false);
  assert.equal(restarted.targetIndex, 0);
  assert.equal(restarted.target.id, "vocabulary-2");
  assert.equal(restarted.phase, SPEAKING_PRACTICE_PHASES.READY);
  assert.equal(native.constructions, 0);
  session.dispose();
});

test("completion blocks stale navigation commands and remains authoritative after cancellation", async () => {
  const { session } = createSession({
    setId: "set-1",
    loadLearningSet: async () => singleLearningSet("set-1"),
  });
  await session.start();
  session.nextTarget();

  assert.equal(session.previousTarget().issue, "ILLEGAL_TRANSITION");
  assert.equal(session.retryAttempt().issue, "ILLEGAL_TRANSITION");
  assert.equal(session.cancel("PAGE_HIDDEN").ok, true);
  assert.equal(session.getSnapshot().completed, true);
  assert.equal(session.getSnapshot().controls.canChangeTarget, false);
  session.dispose();
});

test("defensive completion during LISTENING aborts ownership before stale native results", async () => {
  const controllers = [];
  const { session, native } = createSession({
    setId: "set-1",
    controllers,
    loadLearningSet: async () => singleLearningSet("set-1"),
  });
  await session.start();
  const controller = controllers[0];
  controller.requestSpeak();
  controller.confirmDisclosureAndStart();
  const recognizer = native.instances[0];
  const staleResult = recognizer.onresult;
  assert.equal(controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.LISTENING);

  assert.equal(session.nextTarget().ok, true);
  assert.equal(native.aborts, 1);
  assert.equal(session.getSnapshot().completed, true);
  const result = [{ transcript: "alone", confidence: 1 }];
  result.isFinal = true;
  staleResult({ resultIndex: 0, results: [result] });

  assert.equal(session.getSnapshot().completed, true);
  assert.equal(session.getSnapshot().result, null);
  assert.equal(session.getSnapshot().controls.canSpeak, false);
  session.dispose();
});

test("visibility binding cancels only on hidden and removes its listener idempotently", () => {
  const listeners = new Map();
  const documentTarget = {
    visibilityState: "visible",
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  let hiddenCalls = 0;
  const remove = bindSpeakingPracticeVisibility(documentTarget, () => { hiddenCalls += 1; });

  listeners.get("visibilitychange")();
  assert.equal(hiddenCalls, 0);
  documentTarget.visibilityState = "hidden";
  listeners.get("visibilitychange")();
  assert.equal(hiddenCalls, 1);
  documentTarget.visibilityState = "visible";
  listeners.get("visibilitychange")();
  assert.equal(hiddenCalls, 1);
  remove();
  remove();
  assert.equal(listeners.has("visibilitychange"), false);
});

test("hidden visibility during initial load does not invalidate the pending NORMAL response", async () => {
  const pending = deferred();
  const { session } = createSession({
    setId: "set-1",
    loadLearningSet: () => pending.promise,
  });
  const loading = session.start();
  await Promise.resolve();

  assert.equal(session.cancel("PAGE_HIDDEN").ok, true);
  pending.resolve(learningSet("set-1"));
  assert.equal((await loading).ok, true);
  assert.equal(session.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.READY);
  session.dispose();
});

test("hidden visibility cancellation stops active recognition and TTS without changing target", async () => {
  const controllers = [];
  const { session, native } = createSession({
    setId: "set-1",
    controllers,
    loadLearningSet: async () => singleLearningSet("set-1"),
  });
  await session.start();
  const controller = controllers[0];
  controller.requestSpeak();
  controller.confirmDisclosureAndStart();
  const recognitionAborts = native.aborts;

  assert.equal(session.cancel("PAGE_HIDDEN").ok, true);
  assert.equal(native.aborts, recognitionAborts + 1);
  assert.equal(session.getSnapshot().target.id, "vocabulary-only");
  assert.equal(session.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.READY);

  controller.listen();
  const speechCancellations = native.speechCancellations;
  assert.equal(session.getSnapshot().playback.phase, "SPEAKING_TTS");
  assert.equal(session.cancel("PAGE_HIDDEN").ok, true);
  assert.equal(native.speechCancellations, speechCancellations + 1);
  assert.equal(session.getSnapshot().target.id, "vocabulary-only");
  assert.equal(session.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.READY);
  session.dispose();
});

test("route remains inside ProtectedRoute, AuthenticatedShell and UserRoute and uses focus shell", () => {
  const router = source("src/app-router.jsx");
  const shell = source("src/auth/ui/authenticated-shell.jsx");
  const userBlock = router.slice(router.indexOf('<Route element={<UserRoute />}>'), router.indexOf('<Route element={<AdminRoute />}>'));

  assert.match(router, /<Route element={<ProtectedRoute \/>}>[\s\S]*<Route element={<AuthenticatedShell \/>}>/);
  assert.match(userBlock, /path="\/pronunciation\/vocabulary-sets\/:setId" element={<SpeakingPracticePage \/>}/);
  assert.match(shell, /startsWith\("\/pronunciation\/vocabulary-sets\/"\)/);
  assert.match(shell, /isFocusLearning[^;]*isSpeakingPractice/);
});

test("React page creates the session in an effect, wires accepted commands and cleans up the exact owner", () => {
  const page = source("src/pronunciation/speaking-practice-page.jsx");
  const renderPrefix = page.slice(0, page.indexOf("useEffect(() =>"));
  assert.doesNotMatch(renderPrefix, /createSpeakingPracticePageSession\(\{/);
  assert.match(page, /useEffect\(\(\) => \{[\s\S]*ownedSession = createSpeakingPracticePageSession/);
  assert.match(page, /sessionRef\.current === ownedSession/);
  assert.match(page, /ownedSession\.dispose\(\)/);
  assert.match(page, /bindSpeakingPracticeVisibility\([\s\S]*ownedSession\.cancel\("PAGE_HIDDEN"\)/);
  assert.match(page, /removeVisibilityListener\(\)/);
  assert.match(page, /ownedSession\.exit\(\)[\s\S]*navigate\(returnTo, \{ replace: true \}\)/);
  assert.match(page, /previousTarget\(\)|nextTarget\(\)|skipTarget\(\)/);
  assert.match(page, /sessionRef\.current\?\.listen\(\)/);
  assert.match(page, /sessionRef\.current\?\.requestSpeak\(\)/);
  assert.match(page, /sessionRef\.current\?\.confirmDisclosureAndStart\(\)/);
  assert.match(page, /sessionRef\.current\?\.deferDisclosure\(\)/);
  assert.match(page, /sessionRef\.current\?\.stopSpeaking\(\)/);
  assert.doesNotMatch(page, /recordMeaningfulEvent|\/api\/learning\/events/);
});

test("Focus Mode UI uses controller controls, mapper copy and approved compact visual contract", () => {
  const page = source("src/pronunciation/speaking-practice-page.jsx");
  const shell = source("src/auth/ui/authenticated-shell.jsx");

  assert.match(page, /getSpeakingPracticePresentation\(snapshot/);
  assert.match(page, /Từ \{currentPosition\} \/ \{totalTargets\}/);
  assert.match(page, /snapshot\.target\?\.word/);
  assert.match(page, /snapshot\.target\?\.phonetic/);
  assert.match(page, /disabled=\{!snapshot\.controls\.canListen\}/);
  assert.match(page, /snapshot\.controls\.canStop/);
  assert.match(page, /disabled=\{!snapshot\.controls\.canSpeak\}/);
  assert.match(page, /data-testid="speaking-actions"/);
  assert.match(page, /flex-col items-center justify-center gap-3 min-\[640px\]:flex-row min-\[640px\]:flex-wrap/);
  assert.match(page, /aria-label=\{presentation\.actions\.listen\.label\}[\s\S]*size-11[\s\S]*min-\[640px\]:w-auto[\s\S]*hidden min-\[640px\]:inline/);
  assert.match(page, /aria-label=\{presentation\.actions\.speak\.label\}[\s\S]*size-11[\s\S]*min-\[640px\]:w-auto[\s\S]*hidden min-\[640px\]:inline/);
  assert.match(page, /aria-label=\{presentation\.actions\.stop\.label\}[\s\S]*<ListeningWaveform \/>\{presentation\.actions\.stop\.label\}/);
  assert.match(page, /disabled=\{!controls\.canConfirmDisclosure\}/);
  assert.match(page, /disabled=\{!snapshot\.controls\.canChangeTarget/);
  assert.match(page, /grid-cols-2[^"]*min-\[480px\]:grid-cols-3/);
  assert.match(page, /PREVIOUS_BUTTON_CLASSES[\s\S]*previousTarget/);
  assert.match(page, /SKIP_BUTTON_CLASSES[\s\S]*skipTarget/);
  assert.match(page, /NEXT_BUTTON_CLASSES[\s\S]*nextTarget/);
  assert.match(page, /presentation\.description[\s\S]*snapshot\.controls\.canRetry[\s\S]*presentation\.disclosure/);
  assert.match(page, /showFeedback = !\[[\s\S]*SPEAKING_PRACTICE_PHASES\.READY,[\s\S]*SPEAKING_PRACTICE_PHASES\.STARTING,[\s\S]*SPEAKING_PRACTICE_PHASES\.LISTENING,[\s\S]*SPEAKING_PRACTICE_PHASES\.FINALIZING,[\s\S]*\]\.includes\(snapshot\.phase\)[\s\S]*presentation\.issue !== null/);
  assert.match(page, /showFeedback \? <FeedbackPanel/);
  assert.match(page, /function ListeningWaveform\(\)[\s\S]*data-testid="listening-waveform"[\s\S]*motion-reduce:animate-none/);
  assert.match(page, /presentation\.announcement \? <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">\{presentation\.announcement\}<\/p>/);
  assert.match(page, /<ListeningWaveform \/>\{presentation\.actions\.stop\.label\}/);
  assert.match(page, /bg-\[#63A0E0\]/);
  assert.match(page, /role="progressbar"[\s\S]*aria-valuemax=\{totalTargets\}[\s\S]*aria-valuenow=\{currentPosition\}/);
  assert.match(page, /bg-slate-200[\s\S]*h-full rounded-full bg-\[#63A0E0\]/);
  assert.match(page, /max-w-\[38rem\]/);
  assert.match(page, /Giọng nói của bạn có thể được xử lý bởi dịch vụ của trình duyệt/);
  assert.match(page, /<details[\s\S]*Tìm hiểu thêm[\s\S]*presentation\.disclosure\.paragraphs/);
  assert.match(page, />Tiếp tục<\/button>/);
  assert.match(page, /speaking-practice-page min-h-full/);
  assert.doesNotMatch(page, /speaking-practice-page h-full min-h-0/);
  assert.match(shell, /isSpeakingPractice \? " speaking-practice-focus-shell !overflow-y-auto"/);
  assert.doesNotMatch(page, /confidence|pronunciation score|recordMeaningfulEvent|\/api\/learning\/events/);
});

test("Outcome and recovery UI uses mapper semantics, Lucide icons and safe transcript rendering", () => {
  const page = source("src/pronunciation/speaking-practice-page.jsx");
  const packageJson = source("package.json");

  assert.match(page, /CheckCircle2/);
  assert.match(page, /XCircle/);
  assert.match(page, /AlertTriangle/);
  assert.match(page, /CircleAlert/);
  assert.match(page, /positive:[\s\S]*#A7E3B8[\s\S]*#ECFDF3[\s\S]*#166534/);
  assert.match(page, /negative:[\s\S]*#F4A8A8[\s\S]*#FEF2F2[\s\S]*#991B1B/);
  assert.match(page, /caution:[\s\S]*#FCD34D[\s\S]*#FFFBEB[\s\S]*#92400E/);
  assert.match(page, /presentation\.issue\.message[\s\S]*presentation\.issue\.recovery/);
  assert.match(page, /presentation\.transcript\.label[\s\S]*presentation\.transcript\.value/);
  assert.match(page, /hasOutcome = presentation\.tone !== "neutral"[\s\S]*presentation\.issue \? FEEDBACK_STYLES\.issue/);
  assert.match(page, /!hasOutcome && presentation\.issue[\s\S]*presentation\.issue\.recovery/);
  assert.doesNotMatch(page, /presentation\.clarification/);
  assert.doesNotMatch(page, /Chi tiết và cách khắc phục/);
  assert.match(page, /<\/section>[\s\S]*presentation\.transcript/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML|console\.(?:log|info|debug)|AudioContext|new Audio\(/);
  assert.match(packageJson, /"lucide-react": "\^1\.47\.0"/);
  for (const pictogram of ["✅", "❌", "⚠️", "🔊", "🎤"]) {
    assert.equal(page.includes(pictogram), false, pictogram);
  }
});

test("Speaking progress and navigation stay separate from the compact vocabulary card", () => {
  const page = source("src/pronunciation/speaking-practice-page.jsx");
  const cardStart = page.indexOf('<section className="flex min-h-[25rem]');
  const navigationStart = page.indexOf('<nav className="mt-3 grid w-full');
  const cardClose = page.lastIndexOf("</section>", navigationStart);

  assert.equal(cardStart >= 0, true);
  assert.equal(cardClose > cardStart, true);
  assert.equal(navigationStart > cardClose, true);
  assert.doesNotMatch(page.slice(navigationStart, page.indexOf("</nav>", navigationStart)), /rounded-2xl border border-slate-200 bg-slate-50\/80 p-3/);
  assert.match(page, /NAVIGATION_BUTTON_CLASSES = "[^"]*min-h-\[4\.5rem\][^"]*flex-col[^"]*whitespace-nowrap/);
  assert.match(page, /PREVIOUS_BUTTON_CLASSES[\s\S]*border-\[#C4B5FD\][\s\S]*text-\[#6D4BC3\]/);
  assert.match(page, /SKIP_BUTTON_CLASSES[\s\S]*border-\[#F4C56A\][\s\S]*text-\[#B56808\]/);
  assert.match(page, /NEXT_BUTTON_CLASSES[\s\S]*border-\[#63A0E0\][\s\S]*bg-\[#63A0E0\][\s\S]*text-white/);
  assert.match(page, /NEXT_BUTTON_CLASSES\} col-span-2 min-\[480px\]:col-span-1/);
  assert.match(page, /<ChevronLeft[^>]*>[\s\S]*presentation\.actions\.previous\.label[\s\S]*<SkipForward[^>]*>[\s\S]*presentation\.actions\.skip\.label[\s\S]*<ChevronRight[^>]*>[\s\S]*presentation\.actions\.next\.label/);
  assert.match(page.slice(navigationStart), /previousTarget\(\)[\s\S]*skipTarget\(\)[\s\S]*nextTarget\(\)/);
});

test("page session delegates UI commands to the accepted integrated controller", async () => {
  const controllers = [];
  const { session, native } = createSession({
    setId: "set-1",
    controllers,
    loadLearningSet: async () => singleLearningSet("set-1"),
  });
  await session.start();

  assert.equal(session.listen().ok, true);
  assert.equal(native.speechStarts, 1);
  assert.equal(session.requestSpeak().issue, "DISCLOSURE_REQUIRED");
  assert.equal(session.deferDisclosure().ok, true);
  assert.equal(session.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.READY);
  assert.equal(session.requestSpeak().issue, "DISCLOSURE_REQUIRED");
  assert.equal(session.confirmDisclosureAndStart().ok, true);
  assert.equal(session.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.LISTENING);
  assert.equal(session.stopSpeaking().ok, true);
  session.dispose();
});

function createSession({ setId, loadLearningSet, onSnapshot = () => {}, controllers = [] }) {
  const native = {
    constructions: 0,
    aborts: 0,
    instances: [],
    speechCancellations: 0,
    speechStarts: 0,
  };
  class FakeRecognition {
    constructor() {
      native.constructions += 1;
      native.instances.push(this);
    }
    start() { this.onstart?.(); }
    stop() {}
    abort() { native.aborts += 1; }
  }
  const browserWindow = {
    isSecureContext: true,
    SpeechRecognition: FakeRecognition,
    speechSynthesis: {
      cancel() { native.speechCancellations += 1; },
      speak() { native.speechStarts += 1; },
      getVoices() { return []; },
    },
  };
  const session = createSpeakingPracticePageSession({
    setId,
    loadLearningSet,
    controllerOptions: {
      browserWindow,
      createAudio: () => ({ pause() {}, play: async () => {}, removeAttribute() {}, load() {} }),
      createUtterance: (text) => ({ text }),
    },
    createController(options) {
      const controller = createSpeakingPracticeController(options);
      controllers.push(controller);
      return controller;
    },
    onSnapshot,
  });
  return { session, native };
}

function learningSet(id, name = "Set") {
  return {
    id,
    name,
    mode: "NORMAL",
    total_items: 2,
    cards: [
      { id: "vocabulary-2", word: "book", position: 2, phonetic: null, pronunciation_url: null },
      { id: "vocabulary-1", word: "book", position: 1, phonetic: "/bʊk/", pronunciation_url: "/audio/book.mp3" },
    ],
  };
}

function singleLearningSet(id) {
  return {
    id,
    name: "Single",
    mode: "NORMAL",
    total_items: 1,
    cards: [
      { id: "vocabulary-only", word: "alone", position: 1, phonetic: null, pronunciation_url: null },
    ],
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}
