import { test, expect } from "@playwright/test";
test("training journey, skill tests, challenges, favorites and backup roundtrip", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Train with purpose/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start Training — Free" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: /Let’s put in the work/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "tests/dashboard-desktop.png",
    fullPage: true,
  });
  await expect(page.getByText("DEMO WORKSPACE")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Nickname").fill("Alex");
  await page.getByLabel("Weekly sessions goal").fill("4");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.reload();
  await expect(page.getByLabel("Weekly sessions goal")).toHaveValue("4");
  await expect(page.getByLabel("Nickname")).toHaveValue("Alex");
  await page
    .getByRole("button", { name: "Training Planner", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Plan a session", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await dialog.getByLabel("Date", { exact: true }).fill(tomorrowKey);
  await dialog.getByLabel("Training focus").selectOption("Passing");
  await dialog.getByLabel("Notes").fill("Wall passing practice");
  await dialog.getByRole("button", { name: "Save session" }).click();
  // Open dashboard upcoming entry even if tomorrow lies in the following week.
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: /Passing.*17:30/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Planned minutes").fill("45");
  await dialog.getByRole("button", { name: "Save session" }).click();
  await page.getByRole("button", { name: "Challenges", exact: true }).click();
  const passing = page.locator(".challenge-card").filter({
    has: page.getByRole("heading", { name: "Passing Accuracy", exact: true }),
  });
  await passing.getByRole("button", { name: "Start challenge" }).click();
  await passing
    .getByRole("button", { name: "Log training", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Training focus")).toHaveValue("Passing");
  await dialog.getByLabel("Actual minutes").fill("35");
  await dialog.getByRole("button", { name: "Save training log" }).click();
  await expect(passing.getByText("1 / 5", { exact: true })).toBeVisible();
  // Complete tomorrow’s plan; completion records actual activity today.
  await page
    .getByRole("button", { name: "Training Planner", exact: true })
    .click();
  if (
    (await page.getByRole("button", { name: /17:30.*Passing/ }).count()) === 0
  )
    await page.getByRole("button", { name: "Next week" }).click();
  await page.getByRole("button", { name: "Mark complete" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Actual minutes").fill("40");
  await dialog.getByRole("button", { name: "Save training log" }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Total training time" })
      .locator(".stat-value"),
  ).toHaveText("75min");
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Sessions this week" })
      .locator(".stat-value"),
  ).toHaveText("2/ 4");
  await page
    .getByRole("button", { name: "Progress Tracker", exact: true })
    .click();
  for (const score of ["12", "17"]) {
    await page
      .getByRole("button", { name: "Record test", exact: true })
      .click();
    await page.getByRole("dialog").getByLabel("Result (controls)").fill(score);
    await page.getByRole("button", { name: "Save test result" }).click();
  }
  await expect(
    page.getByText("5 controls better since your first result.", {
      exact: false,
    }),
  ).toBeVisible();
  // Edit and delete history with immediate totals.
  await page.getByRole("button", { name: "Edit Passing" }).first().click();
  await page.getByRole("dialog").getByLabel("Actual minutes").fill("50");
  await page.getByRole("button", { name: "Save training log" }).click();
  await page
    .getByRole("button", { name: "Drill Library", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search drills" }).fill("The wall");
  await expect(page.locator(".drill-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Save The wall is your teammate" })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Saved (1)" }).click();
  await expect(
    page.getByRole("heading", { name: "The wall is your teammate" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Drill" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Count accurate passes in 60 seconds.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON backup" }).click();
  const file = await download;
  const filePath = await file.path();
  const stored = await page.evaluate(() =>
    localStorage.getItem("first-touch-lab-v1"),
  );
  await page.getByRole("button", { name: "Reset all data" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("first-touch-lab-v1")),
  ).toBe(stored);
  await page.getByRole("button", { name: "Reset all data" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Total training time" })
      .locator(".stat-value"),
  ).toHaveText("0min");
  await expect(
    page.getByText("Your first session is a fresh start.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Import JSON backup").setInputFiles(filePath!);
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("first-touch-lab-v1")),
  ).toBe(stored);
  await page.reload();
  await expect(page.getByLabel("Nickname")).toHaveValue("Alex");
  expect(errors).toEqual([]);
});
test("mobile navigation, modal focus, and no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page
    .getByRole("button", { name: "Start Training — Free" })
    .first()
    .click();
  for (const name of [
    "Dashboard",
    "Training Planner",
    "Progress Tracker",
    "Challenges",
    "Drill Library",
    "Settings",
  ]) {
    if (name !== "Dashboard") {
      await page.getByRole("button", { name: "Toggle navigation" }).click();
      await page.getByRole("button", { name, exact: true }).click();
    }
    await expect(
      page.getByRole("heading", {
        name: name === "Dashboard" ? /Let’s put in the work/ : name,
        exact: name !== "Dashboard",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      name,
    ).toBeLessThanOrEqual(320);
  }
  await page.screenshot({ path: "tests/mobile-settings.png", fullPage: true });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page
    .getByRole("button", { name: "Plan a session", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("corrupt local data and invalid backup recover safely", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("first-touch-lab-v1", "{bad json"),
  );
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    "unavailable or unreadable",
  );
  await page.goto("/#Settings");
  await page.getByLabel("Import JSON backup").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1}'),
  });
  await expect(page.getByRole("status")).toContainText("not a valid");
  await expect(page.getByLabel("Weekly sessions goal")).toHaveValue("3");
});

test("deletion, challenge completion and timed comparisons use stored records", async ({
  page,
}) => {
  await page.goto("/#Challenges");
  await page.evaluate(() => {
    const key = "first-touch-lab-v1";
    const data = JSON.parse(localStorage.getItem(key)!);
    data.sessions = [];
    data.results = [];
    data.challenges = [];
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  const challenge = page.locator(".challenge-card").filter({
    has: page.getByRole("heading", {
      name: "5-Session Dribbling",
      exact: true,
    }),
  });
  await challenge.getByRole("button", { name: "Start challenge" }).click();
  for (let i = 0; i < 5; i++) {
    await challenge
      .getByRole("button", { name: "Log training", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save training log" })
      .click();
  }
  await expect(challenge.getByText("Completed — well played!")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Challenge complete");
  await page
    .getByRole("button", { name: "Progress Tracker", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete Dribbling" }).first().click();
  await page
    .getByRole("button", { name: "Delete Session", exact: true })
    .click();
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Sessions completed" })
      .locator(".stat-value"),
  ).toHaveText("4");
  for (const score of ["25.5", "20.25"]) {
    await page
      .getByRole("button", { name: "Record test", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox").selectOption("3");
    await dialog.getByLabel("Result (seconds)").fill(score);
    await dialog.getByRole("button", { name: "Save test result" }).click();
  }
  await page.getByLabel("Skill test").selectOption("3");
  await expect(
    page.getByText("5.25 seconds better since your first result.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Challenges", exact: true }).click();
  await expect(challenge.getByText("4 / 5", { exact: true })).toBeVisible();
});
