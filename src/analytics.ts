import { drillById } from "./drills";
import { challenges, tests } from "./model";

const measurementId = "G-Y346K46JT1";
const disableFlag = `ga-disable-${measurementId}` as const;
const site = "https://footballtraining.github.io/First-Touch-Lab/";
const cookiePath = new URL(site).pathname;
const frameUrl = new URL("analytics.html", site);
const cookiePrefix = "ftl";
export const consentKey = "first-touch-lab-analytics-consent-v1";
const consentCheckKey = `${consentKey}-check`;
export const analyticsAvailable =
  location.href.startsWith(site) &&
  [cookiePath, `${cookiePath}index.html`].includes(location.pathname);
export type Consent = "accepted" | "rejected" | null;

const campaignFields = [
  {
    query: "utm_source",
    config: "campaign_source",
    event: "landing_source",
    values: [
      "instagram",
      "facebook",
      "tiktok",
      "youtube",
      "linkedin",
      "newsletter",
      "partner",
      "qr",
    ],
  },
  {
    query: "utm_medium",
    config: "campaign_medium",
    event: "landing_medium",
    values: ["social", "video", "email", "referral", "offline"],
  },
  {
    query: "utm_campaign",
    config: "campaign_name",
    event: "landing_campaign",
    values: ["launch", "drill_library", "training_planner", "weekly_training"],
  },
] as const;

export const featureNames = {
  Dashboard: "dashboard",
  "Training Planner": "training_planner",
  "Progress Tracker": "progress_tracker",
  Challenges: "challenges",
  "Drill Library": "drill_library",
  Settings: "settings",
} as const;

export type AnalyticsEvent =
  | { name: "feature_view"; feature: keyof typeof featureNames }
  | {
      name: "drill_view" | "drill_completed" | "session_created";
      drillId?: string;
    }
  | { name: "skill_test_completed"; test: number }
  | { name: "challenge_completed"; challenge: number }
  | { name: "progress_updated" };
type Hit = {
  name: AnalyticsEvent["name"];
  params?: Record<string, string | number>;
};
type TagWindow = Window & {
  [disableFlag]?: boolean;
  dataLayer?: IArguments[];
  gtag?: (...command: unknown[]) => void;
};

let frame: HTMLIFrameElement | undefined;
let send: ((hit: Hit) => void) | undefined;

export function hasSavedRejection() {
  try {
    // Only a denial may carry over to a new document, including from v1.
    return localStorage.getItem(consentKey) === "rejected";
  } catch {
    return false;
  }
}

export function prepareConsentStorage() {
  try {
    // Require an observable write and removal. A blocked browser can also
    // silently ignore either operation. The probe never stores a grant.
    const value = localStorage.getItem(consentCheckKey) === "0" ? "1" : "0";
    localStorage.setItem(consentCheckKey, value);
    if (localStorage.getItem(consentCheckKey) !== value) return false;
    localStorage.removeItem(consentCheckKey);
    if (localStorage.getItem(consentCheckKey) !== null) return false;
    localStorage.removeItem(consentKey);
    return localStorage.getItem(consentKey) === null;
  } catch {
    return false;
  }
}

export function saveRejection() {
  try {
    localStorage.setItem(consentKey, "rejected");
    return hasSavedRejection();
  } catch {
    return false;
  }
}

function readCampaignAttribution() {
  const query = new URLSearchParams(location.search);
  const config: Record<string, string> = {};
  const landing: Record<string, string> = {};
  for (const field of campaignFields) {
    const candidates = query.getAll(field.query);
    if (candidates.length !== 1) continue;
    const approved = field.values.find((value) => value === candidates[0]);
    if (approved === undefined) continue;
    config[field.config] = approved;
    landing[field.event] = approved;
  }
  return { config, landing };
}

export function startAnalytics() {
  if (!analyticsAvailable || frame) return;

  const campaign = readCampaignAttribution();
  // Isolate Google automatic detection from the app's URL, DOM and forms.
  const iframe = document.createElement("iframe");
  iframe.hidden = true;
  iframe.title = "Analytics";
  iframe.referrerPolicy = "no-referrer";
  iframe.src = frameUrl.href;
  frame = iframe;
  const pending: Hit[] = [];
  send = (hit) => {
    if (pending.length < 100) pending.push(hit);
  };

  iframe.addEventListener("load", () => {
    if (frame !== iframe) return;
    const doc = iframe.contentDocument;
    const tag = iframe.contentWindow as TagWindow | null;
    if (!doc || !tag || doc.URL !== frameUrl.href) {
      send = undefined;
      return;
    }
    const layer: IArguments[] = [];
    function gtag(..._command: unknown[]) {
      layer.push(arguments);
    }
    tag.dataLayer = layer;
    tag.gtag = gtag;
    const denied = {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    };
    gtag("consent", "default", denied);
    gtag("consent", "update", { ...denied, analytics_storage: "granted" });
    gtag("set", {
      ads_data_redaction: true,
      url_passthrough: false,
      page_location: site,
      page_title: "First Touch Lab",
      page_referrer: "",
      ignore_referrer: true,
    });
    gtag("js", new Date());
    gtag("config", measurementId, {
      ...campaign.config,
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_prefix: cookiePrefix,
      cookie_domain: "none",
      cookie_path: cookiePath,
      cookie_flags: "SameSite=Lax;Secure",
    });

    const script = doc.createElement("script");
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.addEventListener("load", () => {
      if (frame !== iframe) return;
      gtag("event", "page_view", {
        ...campaign.landing,
        send_to: measurementId,
      });
      send = ({ name, params }) =>
        gtag("event", name, { ...params, send_to: measurementId });
      pending.splice(0).forEach(send);
    });
    script.addEventListener("error", () => {
      if (frame === iframe) send = undefined;
    });
    doc.head.append(script);
  });
  document.body.append(iframe);
}

export function stopAnalytics({ preserveCookies = false } = {}) {
  send = undefined;
  // Disable delivery before teardown. Sending a denied update to a running tag
  // could itself produce a cookieless ping.
  if (frame?.contentDocument && frame.contentWindow) {
    (frame.contentWindow as TagWindow)[disableFlag] = true;
  }
  frame?.remove();
  frame = undefined;
  if (preserveCookies) return;
  try {
    for (const suffix of ["ga", `ga_${measurementId.slice(2)}`]) {
      document.cookie = `${cookiePrefix}_${suffix}=; Max-Age=0; Path=${cookiePath}; Secure; SameSite=Lax`;
    }
  } catch {
    // Cookie restrictions must not prevent saving withdrawal.
  }
}

export function track(event: AnalyticsEvent) {
  if (!send) return;
  switch (event.name) {
    case "feature_view":
      send({
        name: event.name,
        params: { feature_name: featureNames[event.feature] },
      });
      return;
    case "drill_view":
    case "drill_completed":
    case "session_created": {
      const drill = drillById(event.drillId);
      if (drill) {
        send({
          name: event.name,
          params: {
            drill_id: drill.id,
            drill_category: drill.focus,
            player_count: drill.players,
          },
        });
      } else if (event.name === "session_created") {
        send({ name: event.name });
      }
      return;
    }
    case "skill_test_completed":
      if (tests[event.test])
        send({ name: event.name, params: { test_id: String(event.test + 1) } });
      return;
    case "challenge_completed":
      if (challenges[event.challenge])
        send({
          name: event.name,
          params: { challenge_id: String(event.challenge + 1) },
        });
      return;
    case "progress_updated":
      send({ name: event.name });
  }
}
