import { drillById, legacyDrillIds } from "./drills.ts";
export const focuses = [
  "Ball Control",
  "First Touch",
  "Passing",
  "Weak Foot",
  "Dribbling",
  "Shooting",
  "Fitness",
  "Custom",
  "Goalkeeper Handling",
  "Goalkeeper Shot Stopping",
  "Goalkeeper Distribution",
  "Goalkeeper Footwork",
] as const;
export type Focus = (typeof focuses)[number];
export type Session = {
  id: string;
  date: string;
  time: string;
  focus: Focus;
  duration: number;
  notes: string;
  completed: boolean;
  actual: number;
  demo?: boolean;
  drillId?: string;
  performance?: string;
};
export const tests = [
  {
    name: "Wall passes in 60 seconds",
    unit: "passes",
    lower: false,
    max: 1000,
  },
  {
    name: "Consecutive weak-foot touches",
    unit: "touches",
    lower: false,
    max: 10000,
  },
  { name: "Keepy-uppies", unit: "touches", lower: false, max: 10000 },
  { name: "Slalom dribble", unit: "seconds", lower: true, max: 3600 },
  {
    name: "First-touch controls out of 20",
    unit: "controls",
    lower: false,
    max: 20,
  },
];
export type Result = {
  id: string;
  test: number;
  score: number;
  date: string;
  demo?: boolean;
};
export type ChallengeState = { id: number; started: string; demo?: boolean };
export type Store = {
  version: 2;
  preferences: {
    nickname: string;
    goal: number;
    minutes: number;
    focus: Focus;
    duration: number;
  };
  sessions: Session[];
  results: Result[];
  challenges: ChallengeState[];
  favorites: string[];
  savedDrills: string[];
  selectedDrillId: string | null;
  schedulingDraft: Session | null;
};
export const id = () => crypto.randomUUID();
export const dateKey = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function offsetDate(n: number, base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
export function weekStart(base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
export function emptyStore(): Store {
  return {
    version: 2,
    preferences: {
      nickname: "",
      goal: 3,
      minutes: 120,
      focus: "First Touch",
      duration: 30,
    },
    sessions: [],
    results: [],
    challenges: [],
    favorites: [],
    savedDrills: [],
    selectedDrillId: null,
    schedulingDraft: null,
  };
}
export function seed(): Store {
  const s = emptyStore();
  s.sessions = Array.from({ length: 15 }, (_, i) => ({
    id: id(),
    date: offsetDate(-i * 2),
    time: "17:30",
    focus: focuses[i % 7],
    duration: 30 + (i % 3) * 10,
    actual: 30 + (i % 3) * 10,
    notes: "A little practice, a little progress.",
    completed: true,
    demo: true,
  }));
  s.sessions.push(
    ...[1, 3, 5].map((n, i) => ({
      id: id(),
      date: offsetDate(n),
      time: i === 1 ? "18:00" : "17:30",
      focus: focuses[i + 1],
      duration: 30,
      actual: 0,
      notes: "Keep it simple. Focus on clean technique.",
      completed: false,
      demo: true,
    })),
  );
  s.results = [
    { id: id(), test: 4, date: offsetDate(-14), score: 11, demo: true },
    { id: id(), test: 4, date: offsetDate(-7), score: 14, demo: true },
    { id: id(), test: 4, date: dateKey(), score: 16, demo: true },
  ];
  s.challenges = [{ id: 0, started: offsetDate(-7), demo: true }];
  return s;
}
export const challenges = [
  {
    name: "7-Day Ball Control",
    description: "Make a little space for the ball, every day.",
    focus: "Ball Control",
    target: 7,
    difficulty: "Beginner",
    rule: "Complete ball control training on 7 distinct days after starting.",
  },
  {
    name: "14-Day Weak Foot",
    description: "Give your other foot a little more attention.",
    focus: "Weak Foot",
    target: 14,
    difficulty: "Intermediate",
    rule: "Complete weak foot training on 14 distinct days after starting.",
  },
  {
    name: "30-Day Training Consistency",
    description: "Build a routine you can keep coming back to.",
    focus: null,
    target: 30,
    difficulty: "All levels",
    rule: "Train on 30 distinct days after starting. Rest days are welcome; days need not be consecutive.",
  },
  {
    name: "First Touch Improvement",
    description: "Set a baseline. Practice. Check in again.",
    test: 4,
    target: 4,
    difficulty: "Beginner",
    rule: "Record a first-touch controls test on 4 distinct days after starting. Scores do not need to increase.",
  },
  {
    name: "Passing Accuracy",
    description: "Turn repetition into a regular passing habit.",
    focus: "Passing",
    target: 5,
    difficulty: "Beginner",
    rule: "Complete 5 passing sessions after starting.",
  },
  {
    name: "5-Session Dribbling",
    description: "Find your rhythm with the ball at your feet.",
    focus: "Dribbling",
    target: 5,
    difficulty: "Intermediate",
    rule: "Complete 5 dribbling sessions after starting.",
  },
];
export function challengeProgress(s: Store, index: number) {
  const active = s.challenges.find((c) => c.id === index);
  if (!active) return 0;
  const c = challenges[index];
  const dates =
    "test" in c
      ? s.results
          .filter(
            (r) =>
              r.test === c.test &&
              r.date >= active.started &&
              r.date <= dateKey(),
          )
          .map((r) => r.date)
      : s.sessions
          .filter(
            (r) =>
              r.completed &&
              r.date >= active.started &&
              r.date <= dateKey() &&
              (!c.focus || r.focus === c.focus),
          )
          .map((r) => r.date);
  return Math.min(c.target, index < 4 ? new Set(dates).size : dates.length);
}
export function stats(s: Store) {
  const done = s.sessions.filter((x) => x.completed);
  const start = dateKey(weekStart());
  const end = offsetDate(7, weekStart());
  let streak = 0;
  let day = dateKey();
  const dates = new Set(done.map((x) => x.date));
  if (!dates.has(day)) day = offsetDate(-1);
  while (dates.has(day)) {
    streak++;
    day = offsetDate(-1, new Date(day + "T12:00:00"));
  }
  return {
    done,
    totalMinutes: done.reduce((a, x) => a + x.actual, 0),
    week: done.filter((x) => x.date >= start && x.date < end),
    streak,
  };
}
const validDate = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(new Date(v + "T12:00:00").getTime()) &&
  dateKey(new Date(v + "T12:00:00")) === v;
const bounded = (n: unknown, min: number, max: number) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
function validBase(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const s = v as Store;
  const p = s.preferences;
  if (
    ![1, 2].includes(s.version) ||
    !p ||
    typeof p.nickname !== "string" ||
    p.nickname.length > 40 ||
    !bounded(p.goal, 1, 14) ||
    !bounded(p.minutes, 1, 10080) ||
    !bounded(p.duration, 1, 600) ||
    !focuses.includes(p.focus)
  )
    return false;
  if (![s.sessions, s.results, s.challenges, s.favorites].every(Array.isArray))
    return false;
  if (s.sessions.length > 10000 || s.results.length > 10000) return false;
  return (
    s.sessions.every(
      (x) =>
        x &&
        typeof x.id === "string" &&
        validDate(x.date) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) &&
        focuses.includes(x.focus) &&
        bounded(x.duration, 1, 600) &&
        bounded(x.actual, x.completed ? 1 : 0, 600) &&
        typeof x.notes === "string" &&
        x.notes.length <= 2000 &&
        typeof x.completed === "boolean" &&
        (!x.completed || x.date <= dateKey()) &&
        (x.demo === undefined || typeof x.demo === "boolean") &&
        (x.drillId === undefined ||
          (typeof x.drillId === "string" && !!drillById(x.drillId))) &&
        (x.performance === undefined ||
          (typeof x.performance === "string" && x.performance.length <= 500)),
    ) &&
    s.results.every(
      (r) =>
        r &&
        typeof r.id === "string" &&
        Number.isInteger(r.test) &&
        r.test >= 0 &&
        r.test < tests.length &&
        validDate(r.date) &&
        r.date <= dateKey() &&
        bounded(r.score, tests[r.test].lower ? 0.01 : 0, tests[r.test].max) &&
        (tests[r.test].lower || Number.isInteger(r.score)) &&
        (r.demo === undefined || typeof r.demo === "boolean"),
    ) &&
    s.challenges.every(
      (c) =>
        c &&
        Number.isInteger(c.id) &&
        c.id >= 0 &&
        c.id < challenges.length &&
        validDate(c.started) &&
        (c.demo === undefined || typeof c.demo === "boolean"),
    ) &&
    s.favorites.every((f: unknown) =>
      s.version === 2
        ? typeof f === "string" && !!drillById(f)
        : typeof f === "number" && Number.isInteger(f) && f >= 0 && f < 12,
    ) &&
    new Set(s.sessions.map((x) => x.id)).size === s.sessions.length &&
    new Set(s.results.map((x) => x.id)).size === s.results.length &&
    new Set(s.challenges.map((x) => x.id)).size === s.challenges.length
  );
}
export function removeDemo(s: Store): Store {
  return {
    ...s,
    sessions: s.sessions.filter((x) => !x.demo),
    results: s.results.filter((x) => !x.demo),
    challenges: s.challenges.filter((x) => !x.demo),
    schedulingDraft: s.schedulingDraft?.demo ? null : s.schedulingDraft,
  };
}

export function validStore(v: unknown): v is Store {
  if (!validBase(v)) return false;
  const s = v as Store;
  return (
    s.version === 2 &&
    Array.isArray(s.savedDrills) &&
    s.savedDrills.every((d) => typeof d === "string" && !!drillById(d)) &&
    new Set(s.savedDrills).size === s.savedDrills.length &&
    (s.selectedDrillId === null ||
      (typeof s.selectedDrillId === "string" &&
        s.savedDrills.includes(s.selectedDrillId))) &&
    (s.schedulingDraft === null ||
      (!!s.schedulingDraft &&
        validBase({ ...s, sessions: [s.schedulingDraft] })))
  );
}
export function readStore(v: unknown): Store | null {
  if (validStore(v)) return v;
  if (!validBase(v) || (v as { version: number }).version !== 1) return null;
  const old = v as Omit<Store, "version" | "favorites"> & {
    version: 1;
    favorites: number[];
  };
  const migrated: Store = {
    ...old,
    version: 2,
    favorites: old.favorites.map((i) => legacyDrillIds[i]),
    savedDrills: [],
    selectedDrillId: null,
    schedulingDraft: null,
  };
  return validStore(migrated) ? migrated : null;
}
export function addSavedDrill(s: Store, drillId: string): Store {
  if (!drillById(drillId)) return s;
  return {
    ...s,
    savedDrills: s.savedDrills.includes(drillId)
      ? s.savedDrills
      : [...s.savedDrills, drillId],
    selectedDrillId: drillId,
  };
}
export function removeSavedDrill(s: Store, drillId: string): Store {
  const savedDrills = s.savedDrills.filter((id) => id !== drillId);
  return {
    ...s,
    savedDrills,
    selectedDrillId:
      s.selectedDrillId === drillId
        ? (savedDrills[0] ?? null)
        : s.selectedDrillId,
  };
}
