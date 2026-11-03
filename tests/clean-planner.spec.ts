import { test, expect, type Page } from "@playwright/test";

const key = "first-touch-lab-v1";
const stored = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);

test("new visitors stay empty across refresh with drills and challenges available", async ({
  page,
}) => {
  await page.goto("/#Dashboard");
  const data = await stored(page);
  for (const name of [
    "sessions",
    "results",
    "challenges",
    "savedDrills",
    "favorites",
  ])
    expect(data[name]).toEqual([]);
  expect(data.preferences.nickname).toBe("");
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Total training time" })
      .locator(".stat-value"),
  ).toHaveText("0min");
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Current streak" })
      .locator(".stat-value"),
  ).toHaveText("0days");
  await page.goto("/#Training%20Planner");
  await expect(page.locator(".calendar-session")).toHaveCount(0);
  await page.goto("/#Progress%20Tracker");
  await expect(page.locator(".session-row")).toHaveCount(0);
  await page.goto("/#Challenges");
  await expect(page.locator(".challenge-card")).toHaveCount(6);
  await expect(
    page.getByRole("button", { name: "Start challenge" }),
  ).toHaveCount(6);
  await page.reload();
  expect(await stored(page)).toEqual(data);
});

test("loading removes only explicit demos and preserves real data", async ({
  page,
}) => {
  await page.goto("/#Dashboard");
  await page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key)!);
    const date = new Date().toLocaleDateString("en-CA");
    const real = {
      id: "real",
      date,
      time: "17:30",
      focus: "Passing",
      duration: 30,
      actual: 25,
      completed: true,
      notes: "My training",
    };
    data.sessions = [real, { ...real, id: "demo", demo: true }];
    data.results = [
      { id: "real-score", test: 4, date, score: 12 },
      { id: "demo-score", test: 4, date, score: 16, demo: true },
    ];
    data.challenges = [
      { id: 4, started: date },
      { id: 0, started: date, demo: true },
    ];
    data.preferences.nickname = "Alex";
    data.savedDrills = ["outfield-3-01"];
    data.favorites = ["outfield-3-01"];
    data.selectedDrillId = "outfield-3-01";
    data.schedulingDraft = {
      ...real,
      id: "draft",
      completed: false,
      actual: 0,
    };
    localStorage.setItem(key, JSON.stringify(data));
  }, key);
  const before = await stored(page);
  await page.reload();
  await expect
    .poll(() => stored(page))
    .toEqual({
      ...before,
      sessions: [before.sessions[0]],
      results: [before.results[0]],
      challenges: [before.challenges[0]],
    });
  await page.reload();
  expect((await stored(page)).sessions).toEqual([before.sessions[0]]);
});

for (const width of [1280, 768, 320]) {
  test(`planner deletion isolates sessions and persists at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#Drill%20Library");
    await page.getByRole("tab", { name: "3 Players", exact: true }).click();
    const drill = page.locator(".drill-card").filter({
      has: page.getByRole("heading", {
        name: "Triangle Passing",
        exact: true,
      }),
    });
    await drill
      .getByRole("button", { name: "Add to Dashboard", exact: true })
      .click();
    // Create two sessions of the same saved drill through the existing scheduling form.
    for (let i = 0; i < 2; i++) {
      await page.goto("/#Drill%20Library");
      await page.getByRole("tab", { name: "3 Players", exact: true }).click();
      await drill
        .getByRole("button", { name: "Schedule Drill", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Notes").fill(`Session ${i}`);
      // Use two dates within the current week.
      const date = new Date();
      date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + i);
      await dialog
        .getByLabel("Date", { exact: true })
        .fill(
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        );
      await dialog
        .getByRole("button", { name: "Save session", exact: true })
        .click();
    }
    const before = await stored(page);
    const cards = page.locator(".calendar-session");
    await expect(cards).toHaveCount(2);
    const trash = cards
      .first()
      .getByRole("button", { name: "Delete Triangle Passing", exact: true });
    await expect(trash).toBeVisible();
    const box = await trash.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await trash.click();
    await expect(
      page.getByRole("dialog", {
        name: "Delete Training Session?",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(
      "Are you sure you want to delete this training session? This action cannot be undone.",
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await stored(page)).toEqual(before);
    await trash.click();
    await page
      .getByRole("button", { name: "Delete Session", exact: true })
      .click();
    await expect(cards).toHaveCount(1);
    const remaining = await stored(page);
    expect(remaining.sessions).toEqual([before.sessions[1]]);
    expect(remaining.savedDrills).toEqual(before.savedDrills);
    await page.reload();
    await expect(cards).toHaveCount(1);
    await cards.getByRole("button", { name: "Mark complete" }).click();
    await page.getByRole("dialog").getByLabel("Actual minutes").fill("25");
    await page
      .getByRole("button", { name: "Save training log", exact: true })
      .click();
    await page.goto("/#Dashboard");
    await expect(
      page
        .locator(".stat-card")
        .filter({ hasText: "Total training time" })
        .locator(".stat-value"),
    ).toHaveText("25min");
    await page.goto("/#Training%20Planner");
    await cards
      .getByRole("button", { name: "Delete Triangle Passing", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete Session", exact: true })
      .click();
    await expect(cards).toHaveCount(0);
    await page.goto("/#Dashboard");
    await expect(
      page
        .locator(".stat-card")
        .filter({ hasText: "Total training time" })
        .locator(".stat-value"),
    ).toHaveText("0min");
    expect((await stored(page)).savedDrills).toEqual(before.savedDrills);
    await page.reload();
    expect((await stored(page)).sessions).toEqual([]);
    await page.goto("/#Drill%20Library");
    await page.getByRole("tab", { name: "3 Players", exact: true }).click();
    await expect(drill).toBeVisible();
  });
}
