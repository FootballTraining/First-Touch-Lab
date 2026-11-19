import { useEffect, useRef, useState } from "react";
import {
  analyticsAvailable,
  consentKey,
  hasSavedRejection,
  prepareConsentStorage,
  saveRejection,
  startAnalytics,
  stopAnalytics,
} from "./analytics";
import type { Consent } from "./analytics";

type ChooseConsent = (choice: Exclude<Consent, null>) => void;
const statusText = {
  undecided: "Analytics is off until you accept.",
  accepted: "Analytics allowed for this page only.",
  "rejected-saved": "Analytics rejected. Your preference is saved.",
  "rejected-unverified":
    "Analytics is off. This browser could not verify that your rejection was saved.",
  unavailable:
    "Analytics is off. This browser could not verify consent controls.",
};
type ConsentStatus = keyof typeof statusText;

function initialStatus(): ConsentStatus {
  return analyticsAvailable && hasSavedRejection()
    ? "rejected-saved"
    : "undecided";
}

function notifyTabs(
  channel: BroadcastChannel | null,
  message: "check" | "withdraw",
) {
  try {
    if (!channel) return false;
    channel.postMessage(message);
    return true;
  } catch {
    return false;
  }
}

export function useAnalyticsConsent() {
  const [status, setStatus] = useState(initialStatus);
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (!analyticsAvailable) return;
    let notifications: BroadcastChannel | null = null;
    try {
      notifications = new BroadcastChannel(consentKey);
    } catch {
      // The visitor can still reject analytics without an open channel.
    }
    channel.current = notifications;
    function applyWithdrawal() {
      stopAnalytics();
      setStatus(hasSavedRejection() ? "rejected-saved" : "rejected-unverified");
    }
    function onMessage(event: MessageEvent) {
      if (event.data === "withdraw") applyWithdrawal();
    }
    function onStorage(event: StorageEvent) {
      if (event.key !== consentKey && event.key !== null) return;
      try {
        if (event.storageArea !== localStorage) return;
      } catch {
        applyWithdrawal();
        return;
      }
      if (event.newValue === "rejected") {
        applyWithdrawal();
      } else if (event.key === null) {
        stopAnalytics();
        setStatus(initialStatus());
      } else if (event.newValue === null) {
        setStatus((current) =>
          current === "rejected-saved" ? initialStatus() : current,
        );
      }
    }
    function onPageHide(event: PageTransitionEvent) {
      if (event.persisted) stopAnalytics({ preserveCookies: true });
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        stopAnalytics({ preserveCookies: true });
        setStatus(initialStatus());
      }
    }
    notifications?.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      notifications?.close();
      channel.current = null;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
  function choose(choice: Exclude<Consent, null>) {
    if (choice === "rejected") {
      stopAnalytics();
      const saved = saveRejection();
      notifyTabs(channel.current, "withdraw");
      setStatus(saved ? "rejected-saved" : "rejected-unverified");
    } else if (
      notifyTabs(channel.current, "check") &&
      prepareConsentStorage()
    ) {
      startAnalytics();
      setStatus("accepted");
    } else {
      stopAnalytics();
      setStatus("unavailable");
    }
  }
  const consent: Consent =
    status === "accepted"
      ? "accepted"
      : status === "rejected-saved" || status === "rejected-unverified"
        ? "rejected"
        : null;
  return { consent, status, choose };
}

type ConsentControls = ReturnType<typeof useAnalyticsConsent>;

function Choices({
  consent,
  choose,
}: {
  consent: Consent;
  choose: ChooseConsent;
}) {
  return (
    <div className="analytics-choices">
      <button
        className="button secondary"
        type="button"
        aria-pressed={consent === "accepted"}
        onClick={() => choose("accepted")}
      >
        Accept Analytics
      </button>
      <button
        className="button secondary"
        type="button"
        aria-pressed={consent === "rejected"}
        onClick={() => choose("rejected")}
      >
        {consent === "accepted" ? "Withdraw Consent" : "Reject Analytics"}
      </button>
    </div>
  );
}

export function AnalyticsBanner({ consent, status, choose }: ConsentControls) {
  return (
    <section
      className="analytics-banner"
      aria-labelledby="analytics-banner-title"
    >
      <div>
        <h2 id="analytics-banner-title">Optional analytics</h2>
        <p>
          Allow Google Analytics on this page to measure visits and use of the
          training tools? You can change your choice in Settings under Privacy
          &amp; data.
        </p>
        {status !== "undecided" && <p role="status">{statusText[status]}</p>}
      </div>
      <Choices consent={consent} choose={choose} />
    </section>
  );
}

export function AnalyticsPrivacy({ consent, status, choose }: ConsentControls) {
  return (
    <>
      <p>
        Your training records, scores, notes and nickname stay in this browser.
        Clearing browser storage may permanently delete your training data.
      </p>
      <h3>Optional Google Analytics</h3>
      <p>
        If you accept on the First Touch Lab website, Google Analytics 4
        measures visits, engagement and use of the training tools. It receives
        the site address and title, basic browser and device information,
        approximate region, approved campaign labels from tagged links, and
        events with catalog details such as drill category and player count.
        Google Analytics uses cookies with a browser identifier to count
        returning browsers. Advertising and remarketing are disabled.
      </p>
      <p>
        Acceptance applies to this page only. The site saves a rejection in this
        browser when it can verify the save. You can change your choice here at
        any time. Withdrawal stops measurement and removes this site's analytics
        cookies when your browser allows it. See{" "}
        <a
          href="https://policies.google.com/technologies/partner-sites"
          rel="noreferrer"
        >
          how Google uses data from sites that use its services
        </a>
        .
      </p>
      {analyticsAvailable ? (
        <>
          <p aria-live="polite">{statusText[status]}</p>
          <Choices consent={consent} choose={choose} />
        </>
      ) : (
        <p>
          Analytics choices are available on the official GitHub Pages site.
        </p>
      )}
    </>
  );
}
