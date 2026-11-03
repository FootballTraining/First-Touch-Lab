import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Footprints,
  Home,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings,
  Star,
  Target,
  Trash2,
  Trophy,
  X,
  Zap,
  BookOpen,
  ChartNoAxesCombined,
  Pencil,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import {
  challenges,
  challengeProgress,
  dateKey,
  emptyStore,
  focuses,
  id,
  offsetDate,
  removeDemo,
  stats,
  tests,
  validStore,
  readStore,
  addSavedDrill,
  removeSavedDrill,
  weekStart,
} from "./model";
import type { Focus, Session, Store } from "./model";
import { drills, drillById } from "./drills";
import {
  DrillLibrary,
  DrillDetails,
  SavedDrills,
  roster,
} from "./DrillFeatures";
import "./style.css";
const KEY = "first-touch-lab-v1";
const pages = [
  "Dashboard",
  "Training Planner",
  "Progress Tracker",
  "Challenges",
  "Drill Library",
  "Settings",
] as const;
type Page = (typeof pages)[number] | "Home";
const icons = [
  LayoutDashboard,
  CalendarDays,
  ChartNoAxesCombined,
  Trophy,
  BookOpen,
  Settings,
];
let loadWarning = "";
function initial(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const s: unknown = JSON.parse(raw);
    const restored = readStore(s);
    if (restored) return removeDemo(restored);
    loadWarning =
      "Your saved data could not be read. An empty workspace is open. You can restore a JSON backup in Settings.";
    return emptyStore();
  } catch {
    loadWarning =
      "Browser storage is unavailable or unreadable. Changes may only last for this visit. Export a backup from Settings.";
    return emptyStore();
  }
}
function App() {
  const [data, setData] = useState(initial);
  const [page, setPage] = useState<Page>(() => {
    const p = decodeURIComponent(location.hash.slice(1));
    return [...pages, "Home"].includes(p) ? (p as Page) : "Home";
  });
  const [notice, setNotice] = useState(loadWarning);
  const [mobile, setMobile] = useState(false);
  const [session, setSession] = useState<Session | null>(data.schedulingDraft);
  const [completing, setCompleting] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    text: string;
    title?: string;
    confirmLabel?: string;
    action: () => void;
  } | null>(null);
  const previousCompleted = useRef(
    new Set(
      data.challenges
        .filter((c) => challengeProgress(data, c.id) >= challenges[c.id].target)
        .map((c) => c.id),
    ),
  );
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      setNotice(
        "Could not save to browser storage. Export your data before closing this page.",
      );
    }
    const completed = new Set(
      data.challenges
        .filter((c) => challengeProgress(data, c.id) >= challenges[c.id].target)
        .map((c) => c.id),
    );
    if ([...completed].some((c) => !previousCompleted.current.has(c)))
      setNotice(
        "Challenge complete! A little consistency goes a long way. Well played!",
      );
    previousCompleted.current = completed;
  }, [data]);
  useEffect(() => {
    const change = () => {
      const p = decodeURIComponent(location.hash.slice(1));
      if ([...pages, "Home"].includes(p)) setPage(p as Page);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  function go(p: Page) {
    setPage(p);
    location.hash = encodeURIComponent(p);
    setMobile(false);
    window.scrollTo({ top: 0 });
  }
  function update(fn: (s: Store) => Store) {
    setData(fn);
  }
  function openSession(
    completed = false,
    existing?: Session,
    drillId?: string,
  ) {
    const d = drillById(drillId);
    setCompleting(false);
    setSession(
      existing ?? {
        id: id(),
        date: dateKey(),
        time: "17:30",
        focus: d?.focus ?? data.preferences.focus,
        duration: d?.duration ?? data.preferences.duration,
        notes: "",
        completed,
        actual: completed ? (d?.duration ?? data.preferences.duration) : 0,
        ...(d ? { drillId: d.id } : {}),
      },
    );
  }
  function addDrill(drillId: string) {
    update((s) => addSavedDrill(s, drillId));
    setDetail(null);
    go("Dashboard");
    setNotice(
      `${drillById(drillId)!.name} added and selected on your dashboard.`,
    );
  }
  function scheduleDrill(drillId: string) {
    setDetail(null);
    go("Training Planner");
    openSession(false, undefined, drillId);
  }
  function closeSession() {
    setSession(null);
    update((d) => ({ ...d, schedulingDraft: null }));
  }
  useEffect(() => {
    if (session && validStore({ ...data, schedulingDraft: session }))
      update((d) => ({ ...d, schedulingDraft: session }));
  }, [session]);
  function complete(s: Session) {
    setCompleting(true);
    setSession({
      ...s,
      date: s.date > dateKey() ? dateKey() : s.date,
      completed: true,
      actual: s.duration,
    });
  }
  function eraseSession(s: Session) {
    setConfirm({
      title: "Delete Training Session?",
      text: "Are you sure you want to delete this training session? This action cannot be undone.",
      confirmLabel: "Delete Session",
      action: () =>
        update((d) => ({
          ...d,
          sessions: d.sessions.filter((x) => x.id !== s.id),
        })),
    });
  }
  const st = stats(data);
  const planButton = (
    <button className="button dark" onClick={() => openSession()}>
      <Plus size={17} /> Plan a session
    </button>
  );
  const sessionList = (
    items: Session[],
    empty = "No sessions here yet. Make some time for your next touch.",
  ) => (
    <div className="session-list">
      {items.length ? (
        items.map((s) => (
          <div className="session-row" key={s.id}>
            <div className={"skill-icon " + (s.completed ? "done" : "")}>
              <Footprints size={20} />
            </div>
            <div className="session-info">
              <strong>
                {drillById(s.drillId)?.name ?? s.focus}
                {s.demo && <small className="demo-tag">DEMO</small>}
              </strong>
              <span>
                {pretty(s.date)} · {s.time} ·{" "}
                {s.completed ? s.actual : s.duration} min
                {s.completed ? " · Completed" : ""}
              </span>
              {s.drillId && (
                <p>
                  {roster(drillById(s.drillId)!)} · {s.focus}
                </p>
              )}
              {s.notes && <p>{s.notes}</p>}
              {s.performance && <p>Performance: {s.performance}</p>}
            </div>
            <div className="row-actions">
              {!s.completed && (
                <button
                  className="icon-button"
                  title="Complete session"
                  aria-label={"Complete " + s.focus}
                  onClick={() => complete(s)}
                >
                  <Check size={18} />
                </button>
              )}
              <button
                className="icon-button"
                aria-label={"Edit " + s.focus}
                onClick={() => openSession(s.completed, s)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button"
                aria-label={"Delete " + s.focus}
                onClick={() => eraseSession(s)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))
      ) : (
        <Empty text={empty} />
      )}
    </div>
  );
  return (
    <>
      {page === "Home" ? (
        <Landing go={go} />
      ) : (
        <div className="app-shell">
          <aside className={mobile ? "sidebar open" : "sidebar"}>
            <Brand onClick={() => go("Home")} />
            <div className="sidebar-caption">YOUR TRAINING SPACE</div>
            <nav>
              {pages.slice(0, 5).map((p, i) => {
                const Icon = icons[i];
                return (
                  <button
                    key={p}
                    className={page === p ? "nav-item active" : "nav-item"}
                    onClick={() => go(p)}
                  >
                    <Icon size={19} />
                    {p}
                    {page === p && <span className="active-dot" />}
                  </button>
                );
              })}
            </nav>
            <div className="sidebar-bottom">
              <div className="free-card">
                <div className="mini-ball">✳</div>
                <strong>Your game. Your pace.</strong>
                <p>
                  A little progress, every day.
                  <br />
                  Train at your own pace.
                </p>
              </div>
              <button
                className={page === "Settings" ? "nav-item active" : "nav-item"}
                onClick={() => go("Settings")}
              >
                <Settings size={19} />
                Settings
              </button>
              <div className="profile">
                <div className="avatar">
                  {(data.preferences.nickname || "P").slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <strong>
                    {data.preferences.nickname || "Your training space"}
                  </strong>
                  <span>Local player · Free plan</span>
                </div>
                <ShieldCheck size={17} />
              </div>
            </div>
          </aside>
          {mobile && (
            <button
              className="scrim"
              aria-label="Close navigation"
              onClick={() => setMobile(false)}
            />
          )}
          <div className="main-shell">
            <header className="topbar">
              <button
                className="icon-button mobile-toggle"
                aria-label="Toggle navigation"
                onClick={() => setMobile(!mobile)}
              >
                <Menu />
              </button>
              <span className="breadcrumb">
                Your workspace <ChevronRight size={13} />
                <strong>{page}</strong>
              </span>
              <div className="top-right">
                <span className="local-badge">
                  <span /> Saved on this device
                </span>
                <button
                  className="avatar small"
                  aria-label="Open settings"
                  onClick={() => go("Settings")}
                >
                  {(data.preferences.nickname || "P").slice(0, 1).toUpperCase()}
                </button>
              </div>
            </header>
            <main>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {page === "Dashboard"
                      ? new Date().toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })
                      : "First Touch Lab"}
                  </div>
                  <h1>
                    {page === "Dashboard"
                      ? `Let’s put in the work${data.preferences.nickname ? ", " + data.preferences.nickname : ""}.`
                      : page}
                  </h1>
                  <p>
                    {
                      (
                        {
                          Dashboard:
                            "Small sessions. Consistent effort. A better relationship with the ball.",
                          "Training Planner":
                            "Give your week a game plan. Leave room for real life.",
                          "Progress Tracker":
                            "Your effort, over time. Every session counts.",
                          Challenges:
                            "A little structure. A reason to keep showing up.",
                          "Drill Library":
                            "Simple ideas for your next session. Pick one and get moving.",
                          Settings:
                            "Make this space your own. Your data stays in your browser.",
                        } as Record<string, string>
                      )[page]
                    }
                  </p>
                </div>
                {page === "Dashboard" || page === "Training Planner" ? (
                  <div className="heading-actions">
                    <button
                      className="button secondary"
                      onClick={() => openSession(true)}
                    >
                      <Plus size={17} /> Log training
                    </button>
                    {planButton}
                  </div>
                ) : null}
              </div>
              {page === "Dashboard" && (
                <>
                  <div className="stat-grid">
                    <Stat
                      label="Sessions this week"
                      value={st.week.length}
                      suffix={"/ " + data.preferences.goal}
                      icon={<CalendarDays size={19} />}
                      note={
                        Math.max(0, data.preferences.goal - st.week.length) +
                        " to your weekly goal"
                      }
                      progress={st.week.length / data.preferences.goal}
                    />
                    <Stat
                      label="Total training time"
                      value={st.totalMinutes}
                      suffix="min"
                      icon={<Clock size={19} />}
                      note="Time invested in your game"
                    />
                    <Stat
                      label="Current streak"
                      value={st.streak}
                      suffix={st.streak === 1 ? "day" : "days"}
                      icon={<Flame size={19} />}
                      note="Consecutive days of training"
                    />
                    <Stat
                      label="Development focus"
                      value={data.preferences.focus}
                      icon={<Target size={19} />}
                      note="One touch at a time"
                    />
                  </div>
                  <div className="dashboard-grid">
                    <div className="dashboard-primary">
                      <SavedDrills
                        data={data}
                        show={setDetail}
                        schedule={scheduleDrill}
                        select={(id) => update((d) => addSavedDrill(d, id))}
                        remove={(drillId) =>
                          setConfirm({
                            text: "Remove this drill from your dashboard? Scheduled sessions and completed training will be kept.",
                            action: () =>
                              update((d) => removeSavedDrill(d, drillId)),
                          })
                        }
                      />
                      {st.done.some((x) => x.drillId) && (
                        <section className="card">
                          <SectionHead
                            title="Recently Completed Drills"
                            subtitle="Actual training, recorded by you."
                          />
                          {sessionList(
                            [...st.done]
                              .filter((x) => x.drillId)
                              .sort(byDate)
                              .slice(0, 4),
                          )}
                        </section>
                      )}

                      <section className="focus-hero">
                        <div className="hero-copy">
                          <span className="hero-label">
                            <span /> BUILT ONE SESSION AT A TIME
                          </span>
                          <h2>
                            Your next touch
                            <br />
                            starts here.
                          </h2>
                          <p>
                            You don’t need a perfect plan.
                            <br />
                            Just a ball, a little space, and a start.
                          </p>
                          <button
                            className="button green"
                            onClick={() => openSession()}
                          >
                            Plan your next session <ArrowUpRight size={17} />
                          </button>
                        </div>
                        <PitchArt />
                      </section>
                      <section className="card">
                        <SectionHead
                          title="Training consistency"
                          subtitle="Your last 7 days, one session at a time."
                          right={
                            <span className="legend">
                              <i />
                              Minutes trained
                            </span>
                          }
                        />
                        <ActivityChart data={data} />
                      </section>
                      <section className="card">
                        <SectionHead
                          title="Recent training"
                          subtitle="The work you’ve put in."
                          right={
                            <button
                              className="text-button"
                              onClick={() => go("Progress Tracker")}
                            >
                              View all <ArrowRight size={15} />
                            </button>
                          }
                        />
                        {sessionList(
                          [...st.done].sort(byDate).slice(0, 3),
                          "Your first session is a fresh start. Log some training to see it here.",
                        )}
                      </section>
                    </div>
                    <div className="dashboard-secondary">
                      <section className="card goal-card">
                        <div className="section-title">
                          <h2>Your weekly goal</h2>
                          <Target size={19} />
                        </div>
                        <div
                          className="goal-ring"
                          style={{
                            background: `conic-gradient(#39E75F ${Math.min(100, (st.week.length / data.preferences.goal) * 100)}%, #edf0ed 0)`,
                          }}
                        >
                          <div>
                            <strong>
                              {st.week.length}
                              <span> / {data.preferences.goal}</span>
                            </strong>
                            <small>sessions completed</small>
                          </div>
                        </div>
                        <p>
                          {st.week.length >= data.preferences.goal
                            ? "Goal reached. Nice work!"
                            : "Keep showing up. You’ve got this."}
                        </p>
                        <button
                          className="text-button"
                          onClick={() => go("Settings")}
                        >
                          Adjust your goal <ArrowUpRight size={14} />
                        </button>
                      </section>
                      <section className="card">
                        <SectionHead
                          title="Coming up"
                          right={
                            <button
                              className="icon-button"
                              aria-label="View planner"
                              onClick={() => go("Training Planner")}
                            >
                              <ArrowUpRight size={18} />
                            </button>
                          }
                        />
                        {data.sessions
                          .filter((s) => !s.completed && s.date >= dateKey())
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .slice(0, 3)
                          .map((s) => (
                            <button
                              className="upcoming"
                              key={s.id}
                              onClick={() => openSession(false, s)}
                            >
                              <div className="date-tile">
                                <span>
                                  {new Date(
                                    s.date + "T12:00",
                                  ).toLocaleDateString(undefined, {
                                    month: "short",
                                  })}
                                </span>
                                <strong>{s.date.slice(8)}</strong>
                              </div>
                              <div>
                                <strong>
                                  {drillById(s.drillId)?.name ?? s.focus}
                                </strong>
                                <span>
                                  {s.time} · {s.duration} min{" "}
                                  {s.demo ? "· Demo" : ""}
                                </span>
                              </div>
                              <ChevronRight size={15} />
                            </button>
                          ))}
                        {!data.sessions.some(
                          (s) => !s.completed && s.date >= dateKey(),
                        ) && (
                          <Empty text="A clear week. Add a session when you’re ready." />
                        )}
                        <button
                          className="add-dashed"
                          onClick={() => openSession()}
                        >
                          <Plus size={15} /> Plan a session
                        </button>
                      </section>
                      <section className="card">
                        <SectionHead
                          title="In the challenge zone"
                          right={<Trophy size={18} />}
                        />
                        {data.challenges.length ? (
                          data.challenges.slice(0, 2).map((a) => (
                            <div className="challenge-mini" key={a.id}>
                              <span className="eyebrow">
                                {challenges[a.id].difficulty}
                              </span>
                              <h3>{challenges[a.id].name}</h3>
                              <Progress
                                value={
                                  challengeProgress(data, a.id) /
                                  challenges[a.id].target
                                }
                              />
                              <small>
                                {challengeProgress(data, a.id)} /{" "}
                                {challenges[a.id].target} completed{" "}
                                {a.demo ? "· Demo" : ""}
                              </small>
                            </div>
                          ))
                        ) : (
                          <p className="muted">
                            Choose a challenge and build a little momentum.
                          </p>
                        )}
                        <button
                          className="text-button"
                          onClick={() => go("Challenges")}
                        >
                          Explore challenges <ArrowRight size={15} />
                        </button>
                      </section>
                    </div>
                  </div>
                </>
              )}
              {page === "Training Planner" && (
                <Planner
                  data={data}
                  open={(s) => openSession(false, s)}
                  add={(date) => {
                    openSession();
                    setSession((s) => (s ? { ...s, date } : s));
                  }}
                  complete={complete}
                  erase={eraseSession}
                />
              )}
              {page === "Progress Tracker" && (
                <ProgressPage
                  data={data}
                  update={update}
                  openLog={() => openSession(true)}
                  openTest={() => setTestOpen(true)}
                  sessionList={sessionList}
                  ask={setConfirm}
                />
              )}
              {page === "Challenges" && (
                <>
                  <div className="info-strip">
                    <Trophy size={20} />
                    <span>
                      Real effort moves the needle. Progress comes from training
                      logs and skill tests dated on or after you start. No
                      deadline; train at your pace.
                    </span>
                  </div>
                  <div className="challenge-grid">
                    {challenges.map((c, i) => {
                      const active = data.challenges.find((a) => a.id === i);
                      const progress = challengeProgress(data, i);
                      const done = progress >= c.target;
                      return (
                        <section
                          className={
                            "card challenge-card " + (done ? "complete" : "")
                          }
                          key={c.name}
                        >
                          <div className="challenge-top">
                            <div className="challenge-number">
                              {done ? (
                                <CheckCircle2 size={30} />
                              ) : (
                                <span>0{i + 1}</span>
                              )}
                            </div>
                            <span className="chip">{c.difficulty}</span>
                          </div>
                          <h2>
                            {c.name}
                            {i < 3 ? " Challenge" : ""}
                          </h2>
                          <p>{c.description}</p>
                          <div className="rules">{c.rule}</div>
                          <div className="progress-label">
                            <span>
                              {done
                                ? "Completed — well played!"
                                : active
                                  ? "In progress"
                                  : "Ready when you are"}
                            </span>
                            <strong>
                              {progress} / {c.target}
                            </strong>
                          </div>
                          <Progress value={progress / c.target} />
                          {active ? (
                            <div className="challenge-buttons">
                              <button
                                className="button secondary"
                                onClick={() =>
                                  i === 3
                                    ? setTestOpen(true)
                                    : openSession(true, {
                                        id: id(),
                                        date: dateKey(),
                                        time: "17:30",
                                        focus: (c.focus ||
                                          data.preferences.focus) as Focus,
                                        duration: data.preferences.duration,
                                        actual: data.preferences.duration,
                                        notes: "",
                                        completed: true,
                                      })
                                }
                              >
                                {i === 3 ? "Record test" : "Log training"}
                              </button>
                              <button
                                className="text-button"
                                onClick={() =>
                                  setConfirm({
                                    text: "Abandon this challenge? Your training logs will be kept.",
                                    action: () =>
                                      update((d) => ({
                                        ...d,
                                        challenges: d.challenges.filter(
                                          (a) => a.id !== i,
                                        ),
                                      })),
                                  })
                                }
                              >
                                Abandon
                              </button>
                            </div>
                          ) : (
                            <button
                              className="button dark full"
                              onClick={() =>
                                update((d) => ({
                                  ...d,
                                  challenges: [
                                    ...d.challenges,
                                    { id: i, started: dateKey() },
                                  ],
                                }))
                              }
                            >
                              Start challenge <ArrowRight size={16} />
                            </button>
                          )}
                          {active?.demo && (
                            <small className="muted">Demo challenge</small>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </>
              )}
              {page === "Drill Library" && (
                <DrillLibrary
                  data={data}
                  update={update}
                  show={setDetail}
                  add={addDrill}
                  schedule={scheduleDrill}
                />
              )}
              {page === "Settings" && (
                <SettingsPage
                  data={data}
                  update={update}
                  notify={setNotice}
                  ask={setConfirm}
                />
              )}
              <footer className="workspace-footer">
                <span>
                  First Touch Lab{" "}
                  <span className="muted">
                    / Prototype · Free to find your rhythm.
                  </span>
                </span>
                <span>
                  <ShieldCheck size={13} /> Private by design. Stored in your
                  browser.
                </span>
              </footer>
            </main>
          </div>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {session && (
        <Modal
          title={
            completing
              ? "Complete your session"
              : session.completed
                ? "Log your training"
                : "Plan your next session"
          }
          close={closeSession}
        >
          <SessionForm
            session={session}
            completing={completing}
            draft={(draft) => {
              if (validStore({ ...data, schedulingDraft: draft }))
                update((d) => ({ ...d, schedulingDraft: draft }));
            }}
            save={(s) => {
              update((d) => ({
                ...d,
                sessions: [...d.sessions.filter((x) => x.id !== s.id), s],
                schedulingDraft: null,
              }));
              setSession(null);
              setNotice(
                s.completed
                  ? "Training logged. That’s time well spent."
                  : "Session saved. See you on the pitch.",
              );
            }}
          />
        </Modal>
      )}
      {testOpen && (
        <Modal title="Record a skill test" close={() => setTestOpen(false)}>
          <TestForm
            save={(r) => {
              update((d) => ({ ...d, results: [...d.results, r] }));
              setTestOpen(false);
              setNotice("Test recorded. Compare your own results over time.");
            }}
          />
        </Modal>
      )}
      {detail !== null && drillById(detail) && (
        <Modal title={drillById(detail)!.name} close={() => setDetail(null)}>
          <DrillDetails
            drill={drillById(detail)!}
            add={addDrill}
            schedule={scheduleDrill}
          />
        </Modal>
      )}
      {confirm && (
        <Modal
          title={confirm.title ?? "Just checking"}
          close={() => setConfirm(null)}
        >
          <p>{confirm.text}</p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              className="button danger"
              onClick={() => {
                confirm.action();
                setConfirm(null);
              }}
            >
              {confirm.confirmLabel ?? "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function pretty(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
function byDate(a: Session, b: Session) {
  return (b.date + b.time).localeCompare(a.date + a.time);
}
function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button className="brand" onClick={onClick}>
      <span className="brand-mark">
        <Footprints size={24} />
      </span>
      <span>
        First Touch
        <span className="brand-lab">
          Lab<span className="brand-dot">+</span>
        </span>
      </span>
    </button>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <div className="progress-track">
      <span style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Footprints size={25} />
      <p>{text}</p>
    </div>
  );
}
function Stat({
  label,
  value,
  suffix,
  icon,
  note,
  progress,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ReactNode;
  note: string;
  progress?: number;
}) {
  return (
    <section className="stat-card">
      <div className="stat-label">
        {label}
        {icon}
      </div>
      <div
        className={
          typeof value === "string" ? "stat-value focus-value" : "stat-value"
        }
      >
        {value}
        <span>{suffix}</span>
      </div>
      {progress !== undefined ? <Progress value={progress} /> : null}
      <small>{note}</small>
    </section>
  );
}
function SectionHead({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
function ActivityChart({ data }: { data: Store }) {
  const values = Array.from({ length: 7 }, (_, i) => {
    const date = offsetDate(i - 6);
    return {
      name: new Date(date + "T12:00").toLocaleDateString(undefined, {
        weekday: "short",
      }),
      minutes: data.sessions
        .filter((s) => s.completed && s.date === date)
        .reduce((a, s) => a + s.actual, 0),
    };
  });
  return (
    <div className="activity-chart">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={values} barSize={30}>
          <CartesianGrid vertical={false} stroke="#edf0ed" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#7b817b" }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#7b817b" }}
            width={30}
          />
          <Tooltip
            cursor={{ fill: "#f3f5f3" }}
            contentStyle={{ borderRadius: 10, border: "1px solid #e5e9e5" }}
          />
          <Bar
            isAnimationActive={false}
            dataKey="minutes"
            name="Minutes"
            fill="#39E75F"
            radius={[5, 5, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      {!values.some((x) => x.minutes) && (
        <p className="chart-empty">Log training to bring your week to life.</p>
      )}
    </div>
  );
}
function PitchArt() {
  return (
    <div className="pitch-art" aria-hidden="true">
      <div className="pitch-lines">
        <div className="center-line" />
        <div className="center-circle" />
        <div className="penalty-box" />
        <div className="goal-box" />
        <div className="pitch-dot one" />
        <div className="pitch-dot two" />
        <div className="pitch-dot three" />
        <svg viewBox="0 0 350 280">
          <path
            d="M65 235 Q 70 95 215 140 T300 40"
            fill="none"
            stroke="#39e75f"
            strokeWidth="2"
            strokeDasharray="6 7"
          />
          <path
            d="m285 42 15-2-2 15"
            fill="none"
            stroke="#39e75f"
            strokeWidth="2"
          />
        </svg>
      </div>
      <div className="football">
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <defs>
            <clipPath id="ball-clip">
              <circle cx="50" cy="50" r="49" />
            </clipPath>
          </defs>
          <g clipPath="url(#ball-clip)" stroke="#50654c" strokeWidth="1.5">
            <circle cx="50" cy="50" r="49" fill="#edf2e0" />
            <path d="M50 27 72 43 63 69 37 69 28 43Z" fill="#263e2b" />
            <path
              d="m50 27 0-20M72 43l21-7M63 69l13 20M37 69 24 89M28 43 7 36"
              fill="none"
            />
            <path
              d="m36 0 14 7 14-7M98 22 93 36l7 14M91 93 76 89 66 100M9 93l15-4 10 11M2 22l5 14-7 14"
              fill="#263e2b"
            />
          </g>
        </svg>
      </div>
      <span className="pitch-caption">THE WORK IS YOURS.</span>
    </div>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closer = useRef(close);
  closer.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = ref.current;
    const selector = 'button,input,select,textarea,[href],[tabindex="0"]';
    (el?.querySelector(selector) as HTMLElement)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closer.current();
      if (e.key === "Tab") {
        const items = Array.from(
          el?.querySelectorAll<HTMLElement>(selector) ?? [],
        ).filter((x) => !x.hasAttribute("disabled"));
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function SessionForm({
  session,
  completing,
  save,
  draft,
}: {
  session: Session;
  draft: (s: Session) => void;
  completing: boolean;
  save: (s: Session) => void;
}) {
  const [s, setState] = useState(session);
  function set(next: Session) {
    setState(next);
    draft(next);
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({ ...s, demo: undefined });
      }}
      className="form"
    >
      <label>
        Selected drill
        <select
          aria-label="Selected drill"
          value={s.drillId ?? ""}
          onChange={(e) => {
            const d = drillById(e.target.value);
            set({
              ...s,
              drillId: d?.id,
              focus: d?.focus ?? s.focus,
              duration: d?.duration ?? s.duration,
            });
          }}
        >
          <option value="">Custom session (no drill)</option>
          {drills.map((d) => (
            <option value={d.id} key={d.id}>
              {d.name} · {d.players} players
              {d.goalkeeper ? " · Goalkeeper" : ""}
            </option>
          ))}
        </select>
      </label>
      {s.drillId && (
        <div className="session-drill-summary">
          <strong>{drillById(s.drillId)!.name}</strong>
          <p>
            {roster(drillById(s.drillId)!)} · {s.focus} · {s.duration} minutes
          </p>
        </div>
      )}
      <div className="form-grid">
        <label>
          Date
          <input
            type="date"
            required
            max={s.completed ? dateKey() : undefined}
            value={s.date}
            onChange={(e) => set({ ...s, date: e.target.value })}
          />
        </label>
        <label>
          Time
          <input
            type="time"
            required
            value={s.time}
            onChange={(e) => set({ ...s, time: e.target.value })}
          />
        </label>
      </div>
      <label>
        Training focus
        <select
          value={s.focus}
          onChange={(e) => set({ ...s, focus: e.target.value as Focus })}
        >
          {focuses.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          Planned minutes
          <input
            type="number"
            min="1"
            max="600"
            required
            value={s.duration}
            onChange={(e) => set({ ...s, duration: Number(e.target.value) })}
          />
        </label>
        {s.completed && (
          <label>
            Actual minutes
            <input
              type="number"
              min="1"
              max="600"
              required
              value={s.actual}
              onChange={(e) => set({ ...s, actual: Number(e.target.value) })}
            />
          </label>
        )}
      </div>
      <label>
        Notes <span className="muted">(optional)</span>
        <textarea
          maxLength={2000}
          rows={3}
          placeholder="What will you work on?"
          value={s.notes}
          onChange={(e) => set({ ...s, notes: e.target.value })}
        />
      </label>
      {s.completed && (
        <label>
          Performance result (optional)
          <input
            maxLength={500}
            placeholder="e.g. 24 accurate passes out of 30"
            value={s.performance ?? ""}
            onChange={(e) => set({ ...s, performance: e.target.value })}
          />
        </label>
      )}
      <p className="muted">
        {completing
          ? "Your actual minutes count toward your training history and challenges."
          : "Find a safe space, warm up, and train at your own pace."}
      </p>
      <button className="button dark full" type="submit">
        <Check size={17} />
        {s.completed ? "Save training log" : "Save session"}
      </button>
    </form>
  );
}
function TestForm({ save }: { save: (r: Store["results"][number]) => void }) {
  const [test, setTest] = useState(4);
  const [date, setDate] = useState(dateKey());
  const [score, setScore] = useState("");
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        save({ id: id(), test, date, score: Number(score) });
      }}
    >
      <label>
        Test
        <select
          value={test}
          onChange={(e) => {
            setTest(Number(e.target.value));
            setScore("");
          }}
        >
          {tests.map((t, i) => (
            <option value={i} key={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Date
        <input
          type="date"
          value={date}
          required
          max={dateKey()}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label>
        Result ({tests[test].unit})
        <input
          type="number"
          min={tests[test].lower ? 0.01 : 0}
          max={tests[test].max}
          step={tests[test].lower ? "0.01" : "1"}
          required
          value={score}
          onChange={(e) => setScore(e.target.value)}
        />
      </label>
      <div className="info-strip">
        {tests[test].lower
          ? "Lower times are better."
          : "Higher scores are better."}{" "}
        Use the same setup each time for a useful comparison. These tests don’t
        measure overall football ability.
      </div>
      <button className="button dark full">
        Save test result <Check size={17} />
      </button>
    </form>
  );
}
function Planner({
  data,
  open,
  add,
  complete,
  erase,
}: {
  data: Store;
  open: (s: Session) => void;
  add: (date: string) => void;
  complete: (s: Session) => void;
  erase: (s: Session) => void;
}) {
  const [week, setWeek] = useState(0);
  const start = weekStart(new Date(offsetDate(week * 7) + "T12:00"));
  return (
    <section className="card planner">
      <div className="section-head">
        <div>
          <h2>
            {pretty(dateKey(start))} – {pretty(offsetDate(6, start))}
          </h2>
          <p>{start.getFullYear()} · Your weekly training plan</p>
        </div>
        <div className="calendar-controls">
          <button
            className="icon-button"
            aria-label="Previous week"
            onClick={() => setWeek((w) => w - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button className="button secondary" onClick={() => setWeek(0)}>
            This week
          </button>
          <button
            className="icon-button"
            aria-label="Next week"
            onClick={() => setWeek((w) => w + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="week-grid">
        {Array.from({ length: 7 }, (_, i) => {
          const date = offsetDate(i, start);
          return (
            <div
              className={"day-column " + (date === dateKey() ? "today" : "")}
              key={date}
            >
              <div className="day-heading">
                <span>
                  {new Date(date + "T12:00").toLocaleDateString(undefined, {
                    weekday: "short",
                  })}
                </span>
                <strong>{date.slice(8)}</strong>
              </div>
              <div className="day-sessions">
                {data.sessions
                  .filter((s) => s.date === date)
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((s) => (
                    <div
                      className={
                        "calendar-session " + (s.completed ? "finished" : "")
                      }
                      key={s.id}
                    >
                      <button onClick={() => open(s)}>
                        <small>
                          {s.time} {s.demo ? "· Demo" : ""}
                        </small>
                        <strong>{drillById(s.drillId)?.name ?? s.focus}</strong>
                        <span>
                          {s.completed ? s.actual : s.duration} minutes
                        </span>
                        <span>{s.completed ? "✓ Completed" : "Planned"}</span>
                      </button>
                      <button
                        className="icon-button calendar-delete"
                        title="Delete training session"
                        aria-label={
                          "Delete " + (drillById(s.drillId)?.name ?? s.focus)
                        }
                        onClick={() => erase(s)}
                      >
                        <Trash2 size={16} />
                      </button>
                      {!s.completed && (
                        <button
                          className="complete-link"
                          onClick={() => complete(s)}
                        >
                          Mark complete <Check size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                <button
                  className="day-add"
                  aria-label={"Add session " + date}
                  onClick={() => add(date)}
                >
                  <Plus size={18} />
                  <span>Add session</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="info-strip">
        <CalendarDays size={18} /> Tap a session to edit it. Complete a planned
        session to log your actual training time.
      </div>
    </section>
  );
}
type Ask = (c: { text: string; action: () => void }) => void;
function ProgressPage({
  data,
  update,
  openLog,
  openTest,
  sessionList,
  ask,
}: {
  data: Store;
  update: (fn: (s: Store) => Store) => void;
  openLog: () => void;
  openTest: () => void;
  sessionList: (s: Session[], empty?: string) => React.ReactNode;
  ask: Ask;
}) {
  const [filter, setFilter] = useState("All skills");
  const [test, setTest] = useState(4);
  const st = stats(data);
  const results = data.results
    .filter((r) => r.test === test)
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = results[0],
    last = results[results.length - 1];
  const difference = first && last ? last.score - first.score : 0;
  const improved = tests[test].lower ? difference < 0 : difference > 0;
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const start = offsetDate((i - 5) * 7, weekStart());
    const end = offsetDate(7, new Date(start + "T12:00"));
    return {
      date: pretty(start),
      sessions: st.done.filter((s) => s.date >= start && s.date < end).length,
    };
  });
  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Sessions completed"
          value={st.done.length}
          icon={<CheckCircle2 size={19} />}
          note="Every session you’ve logged"
        />
        <Stat
          label="Minutes trained"
          value={st.totalMinutes}
          suffix="min"
          icon={<Clock size={19} />}
          note="Your total recorded training time"
        />
        <Stat
          label="This week"
          value={st.week.length}
          suffix={"/ " + data.preferences.goal}
          icon={<Target size={19} />}
          note="Sessions toward your personal goal"
          progress={st.week.length / data.preferences.goal}
        />
        <Stat
          label="Weekly minutes"
          value={st.week.reduce((a, s) => a + s.actual, 0)}
          suffix={"/ " + data.preferences.minutes}
          icon={<Activity size={19} />}
          note="Your weekly minute target"
        />
      </div>
      <div className="two-grid">
        <section className="card">
          <SectionHead
            title="Training frequency"
            subtitle="Sessions per week · last 6 weeks"
          />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeks}>
              <CartesianGrid vertical={false} stroke="#edf0ed" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                width={25}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              <Bar
                isAnimationActive={false}
                dataKey="sessions"
                fill="#39e75f"
                radius={[5, 5, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="card">
          <SectionHead
            title="Daily activity"
            subtitle="Minutes invested over the last 7 days"
          />
          <ActivityChart data={data} />
        </section>
      </div>
      <section className="card focus-breakdown">
        <SectionHead
          title="Skill focus breakdown"
          subtitle="Completed training minutes by focus"
        />
        {focuses
          .filter((f) => st.done.some((s) => s.focus === f))
          .map((f) => {
            const minutes = st.done
              .filter((s) => s.focus === f)
              .reduce((sum, s) => sum + s.actual, 0);
            return (
              <div className="focus-breakdown-row" key={f}>
                <span>{f}</span>
                <Progress
                  value={st.totalMinutes ? minutes / st.totalMinutes : 0}
                />
                <strong>{minutes} min</strong>
              </div>
            );
          })}
        {!st.done.length && (
          <Empty text="Complete a session to see your skill focus breakdown." />
        )}
      </section>
      <section className="card skill-tests">
        <SectionHead
          title="Put a number to your practice"
          subtitle="Repeat a simple test and compare your own results."
          right={
            <button className="button dark" onClick={openTest}>
              <Plus size={16} /> Record test
            </button>
          }
        />
        <div className="two-grid">
          <div>
            <label className="standalone-label">
              Skill test
              <select
                value={test}
                onChange={(e) => setTest(Number(e.target.value))}
              >
                {tests.map((t, i) => (
                  <option value={i} key={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="test-score">
              {last ? last.score : "—"} <span>{tests[test].unit}</span>
            </div>
            <p className="muted">
              {results.length > 1
                ? `${Math.abs(difference)} ${tests[test].unit} ${difference === 0 ? "change" : improved ? "better" : "away from baseline"} since your first result.`
                : "Record two results to see your comparison."}{" "}
              {tests[test].lower ? "Lower is better." : "Higher is better."}
            </p>
            <p className="muted">
              Keep your setup consistent. These are personal practice measures,
              not a rating of your overall football ability.
            </p>
          </div>
          <div>
            {results.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={results.map((r) => ({
                    date: pretty(r.date),
                    score: r.score,
                  }))}
                >
                  <CartesianGrid stroke="#edf0ed" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    domain={test === 4 ? [0, 20] : ["auto", "auto"]}
                    width={30}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#16a53c"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "#39e75f" }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="Your baseline starts here. Record your first test." />
            )}
          </div>
        </div>
        <div className="test-results">
          {[...results].reverse().map((r) => (
            <div key={r.id}>
              <span>
                {pretty(r.date)}{" "}
                {r.demo && <small className="demo-tag">DEMO</small>}
              </span>
              <strong>
                {r.score} {tests[test].unit}
              </strong>
              <button
                className="icon-button"
                aria-label="Delete test result"
                onClick={() =>
                  ask({
                    text: "Delete this test result? This cannot be undone.",
                    action: () =>
                      update((s) => ({
                        ...s,
                        results: s.results.filter((x) => x.id !== r.id),
                      })),
                  })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <SectionHead
          title="Training history"
          right={
            <button className="button dark" onClick={openLog}>
              <Plus size={16} /> Log training
            </button>
          }
        />
        <label className="filter-label">
          Filter by skill
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["All skills", ...focuses].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        {sessionList(
          st.done
            .filter((s) => filter === "All skills" || s.focus === filter)
            .sort(byDate),
          "No completed sessions match. Log a session to start your training history.",
        )}
      </section>
    </>
  );
}
function SettingsPage({
  data,
  update,
  notify,
  ask,
}: {
  data: Store;
  update: (fn: (s: Store) => Store) => void;
  notify: (s: string) => void;
  ask: Ask;
}) {
  const [p, setP] = useState(data.preferences);
  const input = useRef<HTMLInputElement>(null);
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "first-touch-lab-" + dateKey() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Backup exported. Keep it somewhere safe.");
  }
  async function importData(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw Error("Backup exceeds 5 MB.");
      const parsed = readStore(JSON.parse(await file.text()));
      if (!parsed)
        throw Error("This file is not a valid First Touch Lab backup.");
      ask({
        text: "Replace your current workspace with this backup? Export your current data first if you want to keep it.",
        action: () => {
          update(() => removeDemo(parsed));
          setP(parsed.preferences);
          notify("Backup restored. Welcome back.");
        },
      });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not read backup.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="settings-grid">
      <section className="card">
        <SectionHead
          title="Your training profile"
          subtitle="A nickname is all you need. No accounts. No sign-up."
        />
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            update((s) => ({ ...s, preferences: p }));
            notify("Your preferences are saved.");
          }}
        >
          <label>
            Nickname
            <input
              maxLength={40}
              value={p.nickname}
              placeholder="What should we call you?"
              onChange={(e) => setP({ ...p, nickname: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Weekly sessions goal
              <input
                required
                type="number"
                min="1"
                max="14"
                value={p.goal}
                onChange={(e) => setP({ ...p, goal: Number(e.target.value) })}
              />
            </label>
            <label>
              Weekly minutes target
              <input
                required
                type="number"
                min="1"
                max="10080"
                value={p.minutes}
                onChange={(e) =>
                  setP({ ...p, minutes: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label>
            Main development focus
            <select
              value={p.focus}
              onChange={(e) => setP({ ...p, focus: e.target.value as Focus })}
            >
              {focuses.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Preferred session duration (minutes)
            <input
              required
              type="number"
              min="1"
              max="600"
              value={p.duration}
              onChange={(e) => setP({ ...p, duration: Number(e.target.value) })}
            />
          </label>
          <button className="button dark">
            Save preferences <Check size={17} />
          </button>
        </form>
      </section>
      <div>
        <section className="card">
          <SectionHead title="Your data. Your control." />
          <p className="muted">
            Save a backup before changing devices or clearing your browser.
          </p>
          <div className="data-actions">
            <button className="button secondary" onClick={exportData}>
              <ArrowDownToLine size={16} /> Export JSON backup
            </button>
            <button
              className="button secondary"
              onClick={() => input.current?.click()}
            >
              Import backup <ArrowUpRight size={16} />
            </button>
            <input
              ref={input}
              type="file"
              accept="application/json,.json"
              hidden
              aria-label="Import JSON backup"
              onChange={(e) => void importData(e.target.files?.[0])}
            />
          </div>
          <hr />
          <button
            className="text-button danger-text"
            onClick={() =>
              ask({
                text: "Reset your entire workspace to empty? This deletes all sessions, skill tests, challenges, favorites, and preferences. Export a backup first. This cannot be undone.",
                action: () => {
                  update(() => emptyStore());
                  setP(emptyStore().preferences);
                  notify("Workspace reset. A fresh start.");
                },
              })
            }
          >
            <Trash2 size={15} /> Reset all data
          </button>
        </section>
        <section className="card privacy-card">
          <ShieldCheck size={23} />
          <h2>Just you and your game.</h2>
          <p>
            This prototype stores training data only in this browser. No
            accounts, tracking, email collection, or external data transmission.
            Clearing browser storage may permanently delete your data.
          </p>
          <p>
            Use a nickname, and keep sensitive personal information out of
            notes. This is a planning and practice tool, not professional
            coaching or medical advice.
          </p>
          <small>First Touch Lab · Prototype / Demo</small>
        </section>
      </div>
    </div>
  );
}
function Landing({ go }: { go: (p: Page) => void }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand onClick={() => go("Home")} />
        <nav>
          <a href="#features">The toolkit</a>
          <a href="#how-it-works">How it works</a>
          <a href="#faq">FAQs</a>
        </nav>
        <button className="button dark" onClick={() => go("Dashboard")}>
          Enter the Lab <ArrowUpRight size={17} />
        </button>
      </header>
      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="landing-kicker">
              <span /> YOUR GAME. YOUR NEXT LEVEL.
            </span>
            <h1>
              Train with purpose.
              <br />
              Improve <em>every</em>
              <br />
              touch<span className="green-text">.</span>
            </h1>
            <p>
              Plan your sessions. Track your progress.
              <br />
              Become a more consistent footballer.
            </p>
            <div className="hero-actions">
              <button className="button green" onClick={() => go("Dashboard")}>
                Start Training — Free <ArrowUpRight size={19} />
              </button>
              <a className="button secondary" href="#features">
                Explore Features <ArrowRight size={17} />
              </a>
            </div>
            <span className="landing-reassurance">
              <ShieldCheck size={15} /> No sign-up. No fees. Just football.
            </span>
          </div>
          <div className="landing-art">
            <div className="art-topline">
              <span>First Touch Lab / TRAINING SYSTEM</span>
              <span>01 — ∞</span>
            </div>
            <PitchArt />
            <div className="art-bottom">
              <span>
                CONSISTENCY
                <br />
                OVER PERFECTION.
              </span>
              <Footprints size={35} />
            </div>
            <div className="floating-session">
              <span className="skill-icon">
                <Check size={23} />
              </span>
              <div>
                <strong>A little progress, every day.</strong>
                <span>Your next session is a fresh start.</span>
              </div>
            </div>
          </div>
        </section>
        <section className="landing-intro" id="features">
          <span className="eyebrow">LESS GUESSWORK. MORE GAME.</span>
          <h2>
            A simple toolkit.
            <br />A stronger training habit.
          </h2>
          <div className="feature-grid">
            {[
              {
                icon: CalendarDays,
                title: "Make a game plan.",
                text: "Build your own weekly training schedule. Choose a focus, set a time, and make it happen.",
                page: "Training Planner",
              },
              {
                icon: ChartNoAxesCombined,
                title: "See the work add up.",
                text: "Track your sessions, minutes, and personal skill tests. Progress you can actually look back on.",
                page: "Progress Tracker",
              },
              {
                icon: Trophy,
                title: "Find your momentum.",
                text: "Try a challenge that keeps you coming back. Real training, real milestones, at your own pace.",
                page: "Challenges",
              },
            ].map((f, i) => (
              <button
                key={f.title}
                className="landing-feature"
                onClick={() => go(f.page as Page)}
              >
                <div>
                  <f.icon size={25} />
                  <span>0{i + 1}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <span className="text-button">
                  Explore {f.page} <ArrowUpRight size={16} />
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="landing-dashboard">
          <div>
            <span className="eyebrow">A HOME FOR YOUR TRAINING</span>
            <h2>
              Show up.
              <br />
              Keep track.
              <br />
              Go again.
            </h2>
            <p>
              Your dashboard brings your plans and progress together. No
              complicated setup. Just a clearer picture of the work you’re
              doing.
            </p>
            <button className="button dark" onClick={() => go("Dashboard")}>
              Try the live dashboard <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="dashboard-preview">
            <div className="preview-header">
              <span className="preview-logo">✳ First Touch Lab</span>
              <span>INTERACTIVE DEMO</span>
            </div>
            <h3>Your training starts here.</h3>
            <div className="preview-stats">
              <div>
                <CalendarDays />
                <strong>Plan</strong>
                <span>Make time for your game</span>
              </div>
              <div>
                <Activity />
                <strong>Track</strong>
                <span>See your effort add up</span>
              </div>
              <div>
                <Trophy />
                <strong>Repeat</strong>
                <span>Build your own rhythm</span>
              </div>
            </div>
            <button className="preview-pitch" onClick={() => go("Dashboard")}>
              <PitchArt />
              <span>
                Open your workspace <ArrowUpRight size={19} />
              </span>
            </button>
          </div>
        </section>
        <section id="how-it-works" className="how-section">
          <span className="eyebrow">YOUR FIRST THREE TOUCHES</span>
          <h2>Less setup. More kick-off.</h2>
          <div className="feature-grid">
            {[
              [
                "01",
                "Make it yours",
                "Choose a nickname, a weekly goal, and something you want to work on.",
              ],
              [
                "02",
                "Put in a session",
                "Pick a drill or plan your own training. A ball and a little space are enough.",
              ],
              [
                "03",
                "Keep coming back",
                "Log what you did. Check your progress. Find a routine that fits your life.",
              ],
            ].map(([n, t, b]) => (
              <div key={n}>
                <span className="step-number">{n}</span>
                <h3>{t}</h3>
                <p>{b}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="faq" className="faq-section">
          <div>
            <span className="eyebrow">GOOD QUESTIONS</span>
            <h2>
              Before you
              <br />
              lace up.
            </h2>
          </div>
          <div>
            {[
              [
                "Is First Touch Lab really free?",
                "Yes. All training features are free.",
              ],
              [
                "Do I need an account?",
                "No. Choose an optional nickname and start. Your data stays in your current browser; export a JSON backup to keep a copy.",
              ],
              [
                "Is this professional coaching?",
                "No. This is a simple way to organize individual practice. The drills are general beginner-friendly ideas, not professional coaching or promises of performance.",
              ],
              [
                "What happens to my training data?",
                "It is stored locally in your browser, with no trackers or external data transmission. Clearing storage may delete it. Settings lets you export, import, or reset your data.",
              ],
              [
                "What will I see when I start?",
                "Your workspace starts empty. Log training, record skill tests, or schedule a drill to build your own progress.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Plus size={17} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-cta">
          <span className="eyebrow">THE NEXT TOUCH IS YOURS.</span>
          <h2>
            A little practice.
            <br />A lot of possibility.
          </h2>
          <button className="button green" onClick={() => go("Dashboard")}>
            Start Training — Free <ArrowUpRight size={18} />
          </button>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand onClick={() => go("Home")} />
        <p>Train with purpose. Improve every touch.</p>
        <span>Prototype / Demo · Browser-only storage · No tracking</span>
        <button className="text-button" onClick={() => go("Settings")}>
          Privacy & data <ArrowUpRight size={14} />
        </button>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
