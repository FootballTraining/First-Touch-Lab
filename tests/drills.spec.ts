import { test, expect } from "@playwright/test";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
async function openLibrary(page: any) {
  await page
    .getByRole("button", { name: "Drill Library", exact: true })
    .click();
}
async function enter(page: any) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start Training — Free" })
    .first()
    .click();
}
const card = (page: any, name: string) =>
  page
    .locator(".drill-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
test("A–E exact selection, scheduling, goalkeeper roster, progress, and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await openLibrary(page);
  await page.getByRole("tab", { name: "2 Players", exact: true }).click();
  await expect(page.locator(".drill-card")).toHaveCount(8);
  await card(page, "One-Touch Passing")
    .getByRole("button", { name: "View Drill", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add to Dashboard", exact: true })
    .click();
  await expect(page.locator(".selected-drill h3")).toHaveText(
    "One-Touch Passing",
  );
  await page.reload();
  await expect(page.locator(".selected-drill h3")).toHaveText(
    "One-Touch Passing",
  );
  // Add same drill again: no duplicate, no completed minutes.
  await openLibrary(page);
  await page.getByRole("tab", { name: "2 Players", exact: true }).click();
  await card(page, "One-Touch Passing")
    .getByRole("button", { name: "Add to Dashboard", exact: true })
    .click();
  await expect(page.locator(".saved-drill-row")).toHaveCount(1);
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Total training time" })
      .locator(".stat-value"),
  ).toHaveText("0min");
  await openLibrary(page);
  await page.getByRole("tab", { name: "3 Players", exact: true }).click();
  await expect(page.locator(".drill-card")).toHaveCount(8);
  await card(page, "Triangle Passing")
    .getByRole("button", { name: "Schedule Drill", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Selected drill", { exact: true }),
  ).toHaveValue("outfield-3-01");
  await expect(dialog.locator(".session-drill-summary")).toContainText(
    "3 players",
  );
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const key = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await dialog.getByLabel("Date", { exact: true }).fill(key);
  await dialog.getByLabel("Planned minutes").fill("35");
  await page.reload();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Selected drill", { exact: true }),
  ).toHaveValue("outfield-3-01");
  await expect(dialog.getByLabel("Planned minutes")).toHaveValue("35");
  await dialog
    .getByRole("button", { name: "Save session", exact: true })
    .click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(
    page.locator(".upcoming").filter({ hasText: "Triangle Passing" }),
  ).toContainText("35 min");
  await openLibrary(page);
  await page
    .getByRole("tab", { name: "Goalkeeper Drills", exact: true })
    .click();
  await page.getByLabel("Goalkeeper player count").selectOption("4");
  await expect(page.locator(".drill-card")).toHaveCount(4);
  const gk = card(page, "2v1 Attack Against Goalkeeper");
  await expect(gk).toContainText("4 players · 1 goalkeeper + 3 outfield");
  await gk.getByRole("button", { name: "View Drill", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("img", {
      name: "Two attackers, one defender, one goalkeeper and goal",
    }),
  ).toBeVisible();
  for (const label of ["Attacker A", "Attacker B", "Defender", "Goalkeeper"])
    await expect(
      dialog
        .locator("svg text")
        .filter({ hasText: new RegExp("^" + label + "$") }),
    ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Add to Dashboard", exact: true })
    .click();
  await expect(page.locator(".selected-drill h3")).toHaveText(
    "2v1 Attack Against Goalkeeper",
  );
  await expect(page.locator(".saved-drill-row")).toHaveCount(2);
  // Schedule exact goalkeeper drill through saved card and cancel safely.
  await page
    .locator(".saved-drill-row")
    .filter({ hasText: "2v1 Attack Against Goalkeeper" })
    .getByRole("button", { name: "Schedule", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Selected drill", { exact: true }),
  ).toHaveValue("gk-4-01");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await openLibrary(page);
  await card(page, "Cone Slalom")
    .getByRole("button", { name: "Schedule Drill", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Selected drill", { exact: true }),
  ).toHaveValue("outfield-1-01");
  await dialog
    .getByRole("button", { name: "Save session", exact: true })
    .click();
  await page
    .locator(".calendar-session")
    .filter({ hasText: "Cone Slalom" })
    .getByRole("button", { name: "Mark complete" })
    .click();
  await page.getByRole("dialog").getByLabel("Actual minutes").fill("27");
  await page
    .getByLabel("Performance result (optional)")
    .fill("3 runs, 2 control errors");
  await page.getByRole("button", { name: "Save training log" }).click();
  await page
    .getByRole("button", { name: "Progress Tracker", exact: true })
    .click();
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Minutes trained" })
      .locator(".stat-value"),
  ).toHaveText("27min");
  await expect(
    page.locator(".session-row").filter({ hasText: "Cone Slalom" }),
  ).toContainText("3 runs, 2 control errors");
  await expect(
    page.getByText("Skill focus breakdown", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Recently Completed Drills",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove One-Touch Passing", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.reload();
  await expect(page.locator(".saved-drill-row")).toHaveCount(1);
  await expect(page.locator(".selected-drill h3")).toHaveText(
    "2v1 Attack Against Goalkeeper",
  );
  await expect(
    page.locator(".upcoming").filter({ hasText: "Triangle Passing" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Total training time" })
      .locator(".stat-value"),
  ).toHaveText("27min");
  expect(errors).toEqual([]);
});
test("all drill tabs, goalkeeper count filters, keyboard navigation and 320px layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/#Drill%20Library");
  await expect(
    page.getByRole("tab", { name: "1 Player", exact: true }),
  ).toBeVisible();
  for (const name of [
    "1 Player",
    "2 Players",
    "3 Players",
    "4 Players",
    "Goalkeeper Drills",
  ]) {
    await page.getByRole("tab", { name, exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  }
  for (const n of ["1", "2", "3", "4"]) {
    await page.getByLabel("Goalkeeper player count").selectOption(n);
    await expect(page.locator(".drill-card")).toHaveCount(4);
  }
  await page.screenshot({ path: "tests/drills-mobile.png", fullPage: true });
  await page.getByRole("tab", { name: "2 Players", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "3 Players", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Search drills").fill("triangle");
  await expect(page.locator(".drill-card")).toHaveCount(2);
  await page
    .getByLabel("Filter drills by difficulty")
    .selectOption("Intermediate");
  await expect(page.locator(".drill-card")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator(".drill-card")).toHaveCount(8);
});
