import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

const site = "https://footballtraining.github.io/First-Touch-Lab/";
const tagUrl = "https://www.googletagmanager.com/gtag/js?id=G-Y346K46JT1";
const collectUrl = "https://www.google-analytics.com/g/collect";
const consentKey = "first-touch-lab-analytics-consent-v1";
const rejectedUnverified =
  "Analytics is off. This browser could not verify that your rejection was saved.";
const unavailable =
  "Analytics is off. This browser could not verify consent controls.";
const consentBanner = (page: Page) =>
  page.getByRole("region", { name: "Optional analytics" });
const acceptAnalytics = (page: Page) =>
  consentBanner(page).getByRole("button", { name: "Accept Analytics" });
const privateText = "private-value@example.com";
const drill = {
  drill_id: "outfield-1-01",
  drill_category: "Dribbling",
  player_count: 1,
};

async function servePages(context: BrowserContext, blocked = false) {
  const root = resolve("docs");
  const hits: { name: string; params: Record<string, unknown> }[] = [];
  const googleRequests: string[] = [];
  const frames: string[] = [];
  context.on("request", (request) => {
    if (!request.url().startsWith(site)) googleRequests.push(request.url());
  });
  await context.route(site + "**", async (route) => {
    const relative = new URL(route.request().url()).pathname.slice(
      new URL(site).pathname.length,
    );
    const file = resolve(root, relative || "index.html");
    if (!file.startsWith(root + sep)) return route.abort();
    if (relative === "analytics.html") {
      frames.push(route.request().headers().referer ?? "");
    }
    const contentType = file.endsWith(".js")
      ? "application/javascript"
      : file.endsWith(".css")
        ? "text/css"
        : "text/html";
    await route.fulfill({ contentType, body: await readFile(file) });
  });
  await context.route(/^https:\/\//, async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.startsWith(site)) return route.fallback();
    if (url === tagUrl && !blocked) {
      expect(request.headers().referer).toBeUndefined();
      // Simulate gtag's command queue and transport without writing to GA4.
      const body = `
        document.cookie = 'ftl_ga=fixture; Path=/First-Touch-Lab/; Secure';
        document.cookie = 'ftl_ga_Y346K46JT1=fixture; Path=/First-Touch-Lab/; Secure';
        const push = dataLayer.push.bind(dataLayer);
        dataLayer.push = function (entry) {
          if (entry[0] === "event" && !window["ga-disable-G-Y346K46JT1"]) {
            fetch(${JSON.stringify(collectUrl)}, {
              method: "POST", mode: "no-cors", keepalive: true,
              body: JSON.stringify({ name: entry[1], params: entry[2] })
            }).catch(() => {});
          }
          return push(entry);
        };
        window.addEventListener("pagehide", () => gtag("event", "fixture_pagehide", {}));
      `;
      return route.fulfill({ contentType: "application/javascript", body });
    }
    if (url === collectUrl) {
      hits.push(request.postDataJSON());
      return route.fulfill({ status: 204 });
    }
    await route.abort();
  });
  return { hits, googleRequests, frames };
}

function tagCommands(page: Page) {
  return page
    .frame({ url: site + "analytics.html" })!
    .evaluate(() =>
      (window as unknown as { dataLayer: IArguments[] }).dataLayer.map(
        (entry) => Array.from(entry),
      ),
    );
}

async function openDrill(page: Page) {
  await page
    .locator(".drill-card")
    .filter({
      has: page.getByRole("heading", { name: "Cone Slalom", exact: true }),
    })
    .getByRole("button", { name: "View Drill", exact: true })
    .click();
}

test("mobile first visit and remembered rejection make no analytics requests", async ({
  context,
  page,
}) => {
  const { googleRequests, frames } = await servePages(context);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(
    site +
      "?utm_source=facebook&utm_medium=social&utm_campaign=launch&search=" +
      privateText +
      "#%E0",
  );
  const banner = page.getByRole("region", { name: "Optional analytics" });
  const accept = banner.getByRole("button", { name: "Accept Analytics" });
  const reject = banner.getByRole("button", { name: "Reject Analytics" });
  await expect(accept).toBeVisible();
  await expect(reject).toBeVisible();
  expect((await accept.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await reject.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );

  await page
    .getByRole("button", { name: "Start Training — Free" })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Plan a session", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/Session saved/);
  await accept.focus();
  await page.keyboard.press("Tab");
  await expect(reject).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("Analytics rejected.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  expect(frames).toEqual([]);
  expect(googleRequests).toEqual([]);
});

test("a legacy acceptance is ignored and a new opt-in expires on reload", async ({
  context,
  page,
}) => {
  const { hits, googleRequests, frames } = await servePages(context);
  await page.goto(site);
  await page.evaluate(
    (key) => localStorage.setItem(key, "accepted"),
    consentKey,
  );
  await page.reload();
  await expect(acceptAnalytics(page)).toBeVisible();
  expect(googleRequests).toEqual([]);
  expect(frames).toEqual([]);

  await acceptAnalytics(page).click();
  await expect.poll(() => hits.map(({ name }) => name)).toEqual(["page_view"]);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), consentKey),
  ).toBeNull();
  await page.reload();
  await expect(acceptAnalytics(page)).toBeVisible();
  await expect(page.locator('iframe[title="Analytics"]')).toHaveCount(0);
  expect(googleRequests.filter((url) => url === tagUrl)).toHaveLength(1);
  expect(hits.filter(({ name }) => name === "page_view")).toHaveLength(1);
});

test("restoring a cached document requires fresh consent and keeps its analytics cookies", async ({
  context,
  page,
}) => {
  const { hits, googleRequests } = await servePages(context);
  await page.goto(site);
  await acceptAnalytics(page).click();
  await expect.poll(() => hits.map(({ name }) => name)).toEqual(["page_view"]);
  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  await expect(acceptAnalytics(page)).toBeVisible();
  await expect(page.locator('iframe[title="Analytics"]')).toHaveCount(0);
  expect(googleRequests).toEqual([tagUrl, collectUrl]);
  expect(
    (await context.cookies(site)).filter(({ name }) => name.startsWith("ftl_")),
  ).toHaveLength(2);
});

const storageFailures = [
  ["read failure", "getItem"],
  ["write failure", "setItem"],
  ["removal failure", "removeItem"],
  ["ignored write", "setItem", true],
  ["ignored removal", "removeItem", true],
  ["blocked storage", "blocked"],
] as const;

for (const [name, operation, ignored] of storageFailures) {
  test(`analytics stays off on opt-in and reload with ${name}`, async ({
    context,
    page,
  }) => {
    const { googleRequests, frames } = await servePages(context);
    await page.addInitScript(
      ({ key, operation, ignored }) => {
        if (window !== window.top) return;
        localStorage.setItem(key, "accepted");
        if (operation === "blocked") {
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new DOMException(
                "Storage blocked for this test",
                "SecurityError",
              );
            },
          });
          return;
        }
        const original = Storage.prototype[operation];
        Object.defineProperty(Storage.prototype, operation, {
          value(this: Storage, ...args: string[]) {
            if (args[0] === key || args[0] === key + "-check") {
              if (ignored) return;
              throw new DOMException(
                "Storage operation failed for this test",
                "SecurityError",
              );
            }
            return Reflect.apply(original, this, args);
          },
        });
      },
      { key: consentKey, operation, ignored },
    );

    await page.goto(site);
    await expect(acceptAnalytics(page)).toBeVisible();
    await acceptAnalytics(page).click();
    await expect(consentBanner(page).getByRole("status")).toHaveText(
      unavailable,
    );
    if (operation === "blocked") {
      await consentBanner(page)
        .getByRole("button", { name: "Reject Analytics" })
        .click();
      await expect(consentBanner(page).getByRole("status")).toHaveText(
        rejectedUnverified,
      );
      await page
        .getByRole("button", { name: "Start Training — Free" })
        .first()
        .click();
      await expect(
        page.getByRole("heading", { name: /Let’s put in the work/ }),
      ).toBeVisible();
    }
    await page.reload();
    await expect(acceptAnalytics(page)).toBeVisible();
    await expect(page.locator('iframe[title="Analytics"]')).toHaveCount(0);
    expect(googleRequests).toEqual([]);
    expect(frames).toEqual([]);
  });
}

test("analytics stays off without a working cross-tab channel", async ({
  context,
  page,
}) => {
  const { googleRequests, frames } = await servePages(context);
  await page.addInitScript(() => {
    BroadcastChannel.prototype.postMessage = () => {
      throw new DOMException(
        "Messaging unavailable for this test",
        "InvalidStateError",
      );
    };
  });
  await page.goto(site);
  await acceptAnalytics(page).click();
  await expect(consentBanner(page).getByRole("status")).toHaveText(unavailable);
  await consentBanner(page)
    .getByRole("button", { name: "Reject Analytics" })
    .click();
  await expect(consentBanner(page)).toHaveCount(0);
  await page.reload();
  await expect(consentBanner(page)).toHaveCount(0);
  expect(googleRequests).toEqual([]);
  expect(frames).toEqual([]);
});

test("failed withdrawal writes stop both tabs and a stale grant stays off after reload", async ({
  context,
  page,
}) => {
  const { hits, googleRequests } = await servePages(context);
  await page.goto(site);
  await acceptAnalytics(page).click();
  await expect
    .poll(() => hits.filter(({ name }) => name === "page_view"))
    .toHaveLength(1);
  const otherTab = await context.newPage();
  await otherTab.goto(site);
  await expect(acceptAnalytics(otherTab)).toBeVisible();
  await expect(otherTab.locator('iframe[title="Analytics"]')).toHaveCount(0);
  await acceptAnalytics(otherTab).click();
  await expect
    .poll(() => hits.filter(({ name }) => name === "page_view"))
    .toHaveLength(2);

  await page
    .getByRole("button", { name: "Start Training — Free" })
    .first()
    .click();
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByLabel("Nickname").fill("Saved player");
  await page.getByRole("button", { name: "Save preferences" }).click();
  const workspaceKey = "first-touch-lab-v1";
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    workspaceKey,
  );
  await page.evaluate((key) => {
    localStorage.setItem(key, "accepted");
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key)
        throw new DOMException(
          "Withdrawal write failed for this test",
          "QuotaExceededError",
        );
      original.call(this, name, value);
    };
  }, consentKey);
  await page.getByRole("button", { name: "Withdraw Consent" }).click();

  for (const tab of [page, otherTab]) {
    await expect(consentBanner(tab).getByRole("status")).toHaveText(
      rejectedUnverified,
    );
    await expect(tab.locator('iframe[title="Analytics"]')).toHaveCount(0);
  }
  const requestCount = googleRequests.length;
  expect(
    await page.evaluate((key) => localStorage.getItem(key), consentKey),
  ).toBe("accepted");
  for (const tab of [page, otherTab]) {
    await tab.reload();
    await expect(acceptAnalytics(tab)).toBeVisible();
    await expect(tab.locator('iframe[title="Analytics"]')).toHaveCount(0);
  }
  expect(googleRequests).toHaveLength(requestCount);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), workspaceKey),
  ).toBe(before);
  await expect(page.getByLabel("Nickname")).toHaveValue("Saved player");
});

test("the storage event stops other tabs when messaging fails and readback is reported separately", async ({
  context,
  page,
}) => {
  const { hits, googleRequests } = await servePages(context);
  const otherTab = await context.newPage();
  for (const tab of [page, otherTab]) {
    await tab.goto(site + "#Settings");
    await acceptAnalytics(tab).click();
  }
  await expect
    .poll(() => hits.filter(({ name }) => name === "page_view"))
    .toHaveLength(2);
  await page.evaluate((key) => {
    BroadcastChannel.prototype.postMessage = () => {
      throw new DOMException(
        "Messaging stopped for this test",
        "InvalidStateError",
      );
    };
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (name) {
      if (name === key)
        throw new DOMException(
          "Readback failed for this test",
          "SecurityError",
        );
      return original.call(this, name);
    };
  }, consentKey);
  await page.getByRole("button", { name: "Withdraw Consent" }).click();
  await expect(consentBanner(page).getByRole("status")).toHaveText(
    rejectedUnverified,
  );
  await expect(
    otherTab.getByText("Analytics rejected. Your preference is saved."),
  ).toBeVisible();
  for (const tab of [page, otherTab]) {
    await expect(tab.locator('iframe[title="Analytics"]')).toHaveCount(0);
  }
  const requestCount = googleRequests.length;
  await page.reload();
  await expect(
    page.getByText("Analytics rejected. Your preference is saved."),
  ).toBeVisible();
  expect(googleRequests).toHaveLength(requestCount);
});

test("withdrawal during a pending Google tag download discards queued analytics", async ({
  context,
  page,
}) => {
  const { hits, googleRequests } = await servePages(context);
  let releaseTag = () => {};
  const delay = new Promise<void>((resolve) => {
    releaseTag = resolve;
  });
  await context.route(
    (url) => url.href === tagUrl,
    async (route) => {
      await delay;
      await route.fallback();
    },
  );
  try {
    await page.goto(site + "#Settings");
    await Promise.all([
      page.waitForRequest(tagUrl),
      acceptAnalytics(page).click(),
    ]);
    await page.getByRole("button", { name: "Withdraw Consent" }).click();
  } finally {
    releaseTag();
  }
  await expect(
    page.getByText("Analytics rejected. Your preference is saved."),
  ).toBeVisible();
  await expect(page.locator('iframe[title="Analytics"]')).toHaveCount(0);
  await page.reload();
  await expect(consentBanner(page)).toHaveCount(0);
  expect(googleRequests).toEqual([tagUrl]);
  expect(hits).toEqual([]);
});

const campaignCases = [
  {
    name: "Instagram",
    query: "utm_source=instagram&utm_medium=social&utm_campaign=launch",
    config: {
      campaign_source: "instagram",
      campaign_medium: "social",
      campaign_name: "launch",
    },
    landing: {
      landing_source: "instagram",
      landing_medium: "social",
      landing_campaign: "launch",
    },
  },
  {
    name: "Facebook",
    query: "utm_source=facebook&utm_medium=social&utm_campaign=launch",
    config: {
      campaign_source: "facebook",
      campaign_medium: "social",
      campaign_name: "launch",
    },
    landing: {
      landing_source: "facebook",
      landing_medium: "social",
      landing_campaign: "launch",
    },
  },
  {
    name: "newsletter with an unapproved campaign",
    query: "utm_source=newsletter&utm_medium=email&utm_campaign=" + privateText,
    config: { campaign_source: "newsletter", campaign_medium: "email" },
    landing: { landing_source: "newsletter", landing_medium: "email" },
  },
  {
    name: "unknown values and repeated parameters",
    query:
      "utm_source=Instagram&utm_medium=social&utm_medium=social&utm_campaign=unknown",
    config: {},
    landing: {},
  },
];

for (const { name, query, config, landing } of campaignCases) {
  test(`campaign attribution filters and reports ${name} only after consent`, async ({
    context,
    page,
  }) => {
    const { hits, googleRequests, frames } = await servePages(context);
    const ignored = new URLSearchParams({
      campaign_source: "facebook",
      fbclid: privateText,
      gclid: privateText,
      utm_content: "launch",
      utm_term: privateText,
      UTM_CAMPAIGN: "drill_library",
    });
    await page.goto(site + "?" + query + "&" + ignored + "#" + privateText, {
      referer: "https://example.invalid/referrer?email=" + privateText,
    });
    const accept = page.getByRole("button", { name: "Accept Analytics" });
    await expect(accept).toBeVisible();
    expect(googleRequests).toEqual([]);
    expect(frames).toEqual([]);

    await accept.click();
    await expect
      .poll(() => hits)
      .toEqual([
        { name: "page_view", params: { ...landing, send_to: "G-Y346K46JT1" } },
      ]);
    const commands = await tagCommands(page);
    const tagConfig = commands.find(([command]) => command === "config")![2];
    expect(
      Object.fromEntries(
        Object.entries(tagConfig).filter(([key]) =>
          key.startsWith("campaign_"),
        ),
      ),
    ).toEqual(config);
    expect(commands).toContainEqual([
      "set",
      expect.objectContaining({ page_location: site, page_referrer: "" }),
    ]);
    expect(frames).toEqual([""]);
    expect(googleRequests).toEqual([tagUrl, collectUrl]);
    expect(JSON.stringify(commands)).not.toMatch(
      /private-value|utm_|fbclid|gclid|example\.invalid/,
    );
  });
}

test("accepted analytics sends each expected event and withdrawal stops collection", async ({
  context,
  page,
}) => {
  const { hits, googleRequests, frames } = await servePages(context);
  await page.goto(site + "?q=" + privateText + "#Drill%20Library", {
    referer: "https://example.invalid/path?email=" + privateText,
  });
  await openDrill(page);
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(googleRequests).toEqual([]);

  await page.getByRole("button", { name: "Accept Analytics" }).click();
  await expect
    .poll(() => hits.map((hit) => hit.name))
    .toEqual(["page_view", "feature_view"]);
  const frame = page.frame({ url: site + "analytics.html" })!;
  expect(frames).toEqual([""]);
  expect(
    await frame.evaluate(() => ({
      title: document.title,
      referrer: document.referrer,
      forms: document.forms.length,
    })),
  ).toEqual({ title: "First Touch Lab", referrer: "", forms: 0 });
  const commands = await tagCommands(page);
  expect(commands[0]).toEqual([
    "consent",
    "default",
    {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    },
  ]);
  expect(commands[1]).toEqual([
    "consent",
    "update",
    {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    },
  ]);
  expect(commands[2]).toEqual([
    "set",
    expect.objectContaining({
      page_location: site,
      page_title: "First Touch Lab",
      page_referrer: "",
      ignore_referrer: true,
    }),
  ]);
  expect(commands[4]).toEqual([
    "config",
    "G-Y346K46JT1",
    expect.objectContaining({
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    }),
  ]);

  await page
    .getByRole("button", { name: "Drill Library", exact: true })
    .click();
  await openDrill(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Schedule Drill" })
    .click();
  await page.getByRole("dialog").getByLabel("Notes").fill(privateText);
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await page.getByRole("button", { name: /17:30.*Cone Slalom/ }).click();
  await page.getByRole("button", { name: "Save session", exact: true }).click();

  await page.getByRole("button", { name: "Challenges", exact: true }).click();
  const challenge = page.locator(".challenge-card").filter({
    has: page.getByRole("heading", {
      name: "5-Session Dribbling",
      exact: true,
    }),
  });
  await challenge.getByRole("button", { name: "Start challenge" }).click();
  await page
    .getByRole("button", { name: "Training Planner", exact: true })
    .click();
  await page.getByRole("button", { name: "Mark complete" }).click();
  await page.getByLabel("Performance result").fill(privateText);
  await page.getByRole("button", { name: "Save training log" }).click();
  await page.getByRole("button", { name: /17:30.*Cone Slalom/ }).click();
  await page.getByRole("button", { name: "Save training log" }).click();
  await page.getByRole("button", { name: "Challenges", exact: true }).click();
  for (let i = 0; i < 4; i++) {
    await challenge.getByRole("button", { name: "Log training" }).click();
    await page.getByRole("button", { name: "Save training log" }).click();
  }
  await expect(challenge.getByText("5 / 5")).toBeVisible();
  await page
    .getByRole("button", { name: "Progress Tracker", exact: true })
    .click();
  await page.getByRole("button", { name: "Record test" }).click();
  await page.getByRole("dialog").getByLabel("Result (controls)").fill("17");
  await page.getByRole("button", { name: "Save test result" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Nickname").fill(privateText);
  await page.getByRole("button", { name: "Save preferences" }).click();

  const expected: [string, Record<string, unknown>?][] = [
    ["page_view"],
    ["feature_view", { feature_name: "drill_library" }],
    ["drill_view", drill],
    ["feature_view", { feature_name: "training_planner" }],
    ["session_created", drill],
    ["feature_view", { feature_name: "challenges" }],
    ["feature_view", { feature_name: "training_planner" }],
    ["drill_completed", drill],
    ["progress_updated"],
    ["feature_view", { feature_name: "challenges" }],
    ["session_created"],
    ["progress_updated"],
    ["session_created"],
    ["progress_updated"],
    ["session_created"],
    ["progress_updated"],
    ["session_created"],
    ["progress_updated"],
    ["challenge_completed", { challenge_id: "6" }],
    ["feature_view", { feature_name: "progress_tracker" }],
    ["skill_test_completed", { test_id: "5" }],
    ["progress_updated"],
    ["feature_view", { feature_name: "settings" }],
  ];
  await expect
    .poll(() => hits)
    .toEqual(
      expected.map(([name, params]) => ({
        name,
        params: { ...params, send_to: "G-Y346K46JT1" },
      })),
    );
  expect(JSON.stringify(hits)).not.toContain(privateText);
  expect(googleRequests.filter((url) => url === tagUrl)).toHaveLength(1);
  expect(
    (await context.cookies(site)).filter((cookie) =>
      cookie.name.startsWith("ftl_"),
    ),
  ).toHaveLength(2);

  const otherTab = await context.newPage();
  await otherTab.goto(site);
  await expect(acceptAnalytics(otherTab)).toBeVisible();
  await expect(otherTab.locator('iframe[title="Analytics"]')).toHaveCount(0);
  await acceptAnalytics(otherTab).click();
  await expect
    .poll(() => hits.filter((hit) => hit.name === "page_view"))
    .toHaveLength(2);
  await page.getByRole("button", { name: "Withdraw Consent" }).click();
  await expect(page.getByText("Analytics rejected.")).toBeVisible();
  await expect(page.locator('iframe[title="Analytics"]')).toHaveCount(0);
  await expect(otherTab.locator('iframe[title="Analytics"]')).toHaveCount(0);
  const afterWithdrawal = googleRequests.length;
  for (const tab of [page, otherTab]) {
    await tab.goto(site + "#Drill%20Library");
    await openDrill(tab);
    await tab.getByRole("button", { name: "Close dialog" }).click();
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.reload();
  await expect(page.getByText("Analytics rejected.")).toBeVisible();
  await expect(page.getByLabel("Nickname")).toHaveValue(privateText);
  expect(
    (await context.cookies(site)).filter((cookie) =>
      cookie.name.startsWith("ftl_"),
    ),
  ).toEqual([]);
  expect(googleRequests).toHaveLength(afterWithdrawal);
  expect(hits.some((hit) => hit.name === "fixture_pagehide")).toBe(false);
});

test("a blocked tag leaves mobile training and consent settings working", async ({
  context,
  page,
}) => {
  const { googleRequests, hits } = await servePages(context, true);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(site + "#Training%20Planner");
  await page.getByRole("button", { name: "Accept Analytics" }).click();
  await expect.poll(() => googleRequests).toEqual([tagUrl]);
  await page
    .getByRole("button", { name: "Plan a session", exact: true })
    .click();
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/Session saved/);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Withdraw Consent" }).click();
  await expect(page.getByText("Analytics rejected.")).toBeVisible();
  expect(googleRequests).toEqual([tagUrl]);
  expect(hits).toEqual([]);
  expect(errors).toEqual([]);
});
