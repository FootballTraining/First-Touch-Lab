import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

const site = "https://footballtraining.github.io/First-Touch-Lab/";
const tagUrl = "https://www.googletagmanager.com/gtag/js?id=G-Y346K46JT1";
const collectUrl = "https://www.google-analytics.com/g/collect";
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
  await page.goto(site + "?search=" + privateText + "#%E0");
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
  const commands = await frame.evaluate(() =>
    (window as unknown as { dataLayer: IArguments[] }).dataLayer.map((entry) =>
      Array.from(entry),
    ),
  );
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
