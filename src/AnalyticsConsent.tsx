import { useEffect, useState } from "react";
import {
  analyticsAvailable,
  consentKey,
  readConsent,
  saveConsent,
  startAnalytics,
  stopAnalytics,
} from "./analytics";
import type { Consent } from "./analytics";

type ChooseConsent = (choice: Exclude<Consent, null>) => void;

export function useAnalyticsConsent() {
  const [consent, setConsent] = useState<Consent>(() =>
    analyticsAvailable ? readConsent() : null,
  );
  useEffect(() => {
    if (!analyticsAvailable) return;
    function sync() {
      const saved = readConsent();
      if (saved !== "accepted") stopAnalytics();
      setConsent(saved);
    }
    function onStorage(event: StorageEvent) {
      if (
        event.storageArea === localStorage &&
        (event.key === consentKey || event.key === null)
      )
        sync();
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) sync();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
  useEffect(() => {
    if (consent === "accepted") startAnalytics();
  }, [consent]);
  function choose(choice: Exclude<Consent, null>) {
    if (choice === "rejected") stopAnalytics();
    saveConsent(choice);
    setConsent(choice);
  }
  return { consent, choose };
}

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

export function AnalyticsBanner({ choose }: { choose: ChooseConsent }) {
  return (
    <section
      className="analytics-banner"
      aria-labelledby="analytics-banner-title"
    >
      <div>
        <h2 id="analytics-banner-title">Optional analytics</h2>
        <p>
          Allow Google Analytics to measure visits and use of the training
          tools? You can change your choice in Settings under Privacy &amp;
          data.
        </p>
      </div>
      <Choices consent={null} choose={choose} />
    </section>
  );
}

export function AnalyticsPrivacy({
  consent,
  choose,
}: {
  consent: Consent;
  choose: ChooseConsent;
}) {
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
        This browser remembers your choice separately from your training data.
        You can change it here at any time. Withdrawal stops future measurement
        in this browser and removes this site's analytics cookies. See{" "}
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
          <p aria-live="polite">
            {consent === "accepted"
              ? "Analytics allowed"
              : consent === "rejected"
                ? "Analytics rejected"
                : "Analytics off until you accept"}
            .
          </p>
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
