# First Touch Lab

A functional, browser-only football training prototype. **Train with purpose. Improve every touch.** Built with React, TypeScript, Vite, Tailwind CSS, Lucide icons, and Recharts. Training data stays in the browser. The GitHub Pages site offers optional Google Analytics, with no backend, accounts, or paid services.

## View on GitHub Pages

The complete website source and a prebuilt browser-ready site are in this repository. To publish on GitHub:

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main**, folder **/docs**, and click **Save**.
4. Wait for GitHub to deploy, then use the site link shown by GitHub Pages.

No secrets or API keys are needed. This chat environment cannot change the Pages setting through the GitHub API. GitHub's own Actions infrastructure may need to be enabled for its built-in Pages deployment. If you change source code, run `npm ci` and `npm run build:pages`, then commit the updated `docs/` folder along with your source. The generated build uses relative asset paths and hash navigation so it works under a repository subpath.

## Expanded drill training

The library includes **60 drills**: the requested 48 (8 each for 1, 2, 3, and 4 outfield players and 4 goalkeeper drills for each participant count) plus the original 12 solo drills. Every drill has a stable string ID, instructions, target, equipment, space, difficulty, progression, common mistakes, and safety guidance. A goalkeeper counts as one of the total participants.

**Add to Dashboard** saves and selects the exact drill. Repeating it does not duplicate the drill or count as training. Saved cards support details, scheduling, selection, and confirmed removal. Removing a saved drill preserves scheduled and completed sessions. **Schedule Drill** opens the planner with the same drill ID, participant count, focus, and duration. Valid scheduling drafts survive refresh, including edited dates and durations; cancelling discards a draft. Training forms also let you choose a drill directly. Completion records actual minutes and an optional performance note, feeding history, weekly statistics, skill breakdowns, and Recently Completed Drills.

Goalkeeper training has a dedicated tab, participant filters, and gradual-progression safety guidance. Three original schematic diagrams cover Cone Slalom, Triangle Passing, and the four-person 2v1 attack against goalkeeper. Other drills have participant rosters rather than misleading reused diagrams.

## Open a standalone preview (no installation)

Download `First-Touch-Lab-Preview.zip`, extract it, then open `First-Touch-Lab.html` in Chrome, Edge, or Firefox on your computer. Do not choose “Open in → ChatGPT”; that opens the file in chat rather than running the website. This HTML includes the actual app, styles, icons, and charts; no server or internet connection is needed. The self-contained bundle is tested in Chromium; local-file storage behavior can vary by browser. Managed test browsers block direct file navigation, so the test loads the exact HTML through an intercepted document request and checks it needs no external assets. Export a JSON backup to preserve your training. A file preview and localhost use separate storage.

To generate the standalone HTML from source:

```sh
npm ci
npm run build:portable
```

Open `downloads/First-Touch-Lab.html`. Cloud-host localhost addresses refer to the cloud machine and cannot be opened as localhost on your own computer. For the development workflow below, run the commands on your own computer.

## Run locally

Use Node.js **22.6 or newer** (tested with Node 24) and npm.

```sh
cd First-Touch-Lab-Prototype-
npm ci
npm run dev
```

Open **http://localhost:5173** in your browser. Vite prints another port if 5173 is in use. To serve the production build instead:

```sh
npm run build
npm run preview
```

Open the address printed by Vite (normally http://localhost:4173). Use localhost or HTTPS: UUID generation requires a secure context. Install packages once with internet access. The local and standalone versions run without external requests. All artwork is inline SVG/CSS and typography uses system fonts.

## What works

- Public home page with feature links, live workspace access, how-it-works section, and FAQ.
- Dashboard statistics and activity charts computed from stored training, weekly goals, streaks, upcoming sessions, recent history, and active challenges.
- Weekly planner with navigation, dated/timed sessions, focus, duration, notes, editing, deletion, and actual-minute completion. Completing a future plan records the session on today's date; you can adjust to an earlier actual date.
- Standalone training logs; editable/deletable history and skill filters; session and minute targets.
- Five repeatable skill tests, historical results and charts, baseline comparisons, and deletion. Dribble times treat lower as better; other tests treat higher as better. Tests are personal practice measures, not overall ability ratings.
- Six challenges whose progress derives from actual logged work. Daily challenges count distinct dates; passing and dribbling count sessions. First-touch challenge counts test dates. Only entries dated on/after the start date count. There is no deadline or consecutive-day requirement. Full rules appear on each card. Existing entries from the same day can count; deleting/editing eligible data recalculates progress. Completion produces a celebration notification. Challenges can be abandoned and restarted without deleting logs.
- Sixty drills with player-count tabs, dedicated goalkeeper training, search, skill/difficulty/equipment filters, favorites, exact Add to Dashboard and Schedule Drill integration.
- Persistent preferences, safe JSON backup import/export, and confirmed destructive actions.
- Responsive sidebar/mobile navigation, keyboard focus trapping and Escape for dialogs, reduced-motion support, empty states, and invalid-storage recovery.

## Local data

A first visit starts empty, with no training activity, saved drills, test results, or active challenges. Previously stored entries explicitly marked **Demo** are removed on load; personal entries, saved drills, and preferences are preserved. Settings can reset the entire workspace to empty, with confirmation.

Data uses schema version 2 under the existing localStorage key `first-touch-lab-v1`. Version-one history, preferences, test results, challenges, and numeric favorites automatically migrate; legacy favorite IDs map to the retained original drills. Version-one JSON backups can also be imported. Invalid or orphaned references are rejected. Data is scoped to the browser and site origin. Refreshes preserve data; switching devices, browsers, ports, or origins does not transfer it. Clearing storage can delete it. Export a JSON backup before clearing storage. Imports validate the full schema and value ranges before asking to replace the workspace (maximum file size 5 MB). Corrupt saved data opens an empty workspace with a warning. Storage failures show a warning and keep the current in-memory state usable; export before closing.

No email, birth date, location, or social profile is requested. Use a nickname and avoid sensitive information in notes. Drills are general practice suggestions, not professional coaching or medical advice. Warm up, allow rest, and stop if you feel pain.

## Google Analytics 4

The official GitHub Pages URL uses direct `gtag.js` with Basic Consent Mode and stream `G-Y346K46JT1`. Analytics starts only after opt-in. Each opted-in document sends one manual `page_view` and measures navigation to major workspace features with `feature_view`. Settings → Privacy & data lets visitors change their choice. Withdrawal disables the tag, removes its frame and site-scoped GA cookies, and stops future measurement. Requests already sent or in flight cannot be recalled. Consent is stored separately from the workspace; if browser storage is unavailable it applies for the current document.

| Event                  | Trigger                                                                                                        | Custom parameters                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `drill_view`           | A catalog drill's details open from the library or dashboard                                                   | `drill_id`, `drill_category`, `player_count`  |
| `session_created`      | A new plan or training log is saved                                                                            | Drill fields when a catalog drill is selected |
| `drill_completed`      | A catalog-linked session is first saved as completed                                                           | `drill_id`, `drill_category`, `player_count`  |
| `skill_test_completed` | A valid skill test result is recorded                                                                          | `test_id`                                     |
| `progress_updated`     | A completed log or test result is added or deleted, or a completed log's date, focus, or actual minutes change | None                                          |
| `feature_view`         | The Dashboard, Training Planner, Progress Tracker, Challenges, Drill Library, or Settings opens                | `feature_name`                                |
| `challenge_completed`  | A training action or challenge start crosses an active challenge's completion threshold                        | `challenge_id`                                |

Player count is the catalog's total, including any goalkeeper. Test and challenge IDs are one-based catalog indexes. A feature can be counted again after navigating away and returning. Refreshing, restoring backups, resetting data, opening an unsaved form, and saving an unchanged completed log produce no training completion events. A challenge that drops below its threshold and earns completion again counts as another completion.

The tag runs in a blank same-origin document, so its automatic detection runs outside the training interface. It receives a fixed site URL and page title, with referrer reporting disabled. Browser queries, hashes, referrers, user IDs, workspace records, dates, notes, and scores are excluded from event parameters. Standard GA4 measurement still uses its own cookie-based browser identifier and may include device, browser, and approximate region data. Returning-user counts reflect opted-in browsers that retain these cookies. Referral and URL campaign attribution are intentionally omitted.

### GA4 configuration before release

1. In **Admin → Data streams**, open the stream for `G-Y346K46JT1` and turn off **Enhanced measurement**. Manual page views and app events already cover the intended interactions. In **Configure tag settings**, turn off automatic event detection and user-provided data collection for this tag. Keep Google signals, ads personalization, and any Google Ads or additional tag destinations disabled. [Enhanced measurement](https://support.google.com/analytics/answer/9216061) · [Google tag settings](https://support.google.com/analytics/answer/12131703)
2. Under **Admin → Custom definitions**, add event-scoped dimensions for `feature_name`, `drill_id`, `drill_category`, `player_count`, `test_id`, and `challenge_id` if you want to break down reports by those fields. [Custom dimensions and metrics](https://support.google.com/analytics/answer/14240153)
3. On the official URL after release, use a fresh browser profile and check DevTools Network for no Google requests on first load and after rejection. Accept, exercise the flows above, and verify events in **Realtime** or **DebugView** with Tag Assistant. Withdraw in Settings and repeat the actions to confirm collection stops. Review traffic and returning users in the standard acquisition and retention reports. [DebugView](https://support.google.com/analytics/answer/7201382)

The automated browser tests serve the built site at the official URL via interception and substitute a local tag fixture. They check consent, outgoing event payloads, and blocked-tag behavior without sending test traffic to the GA4 property. Live GA4 delivery and dashboard settings require checking the deployed stream.

## Checks

```sh
npm test                 # 14 data-model tests, no browser needed
npm run typecheck
npm run build
npm run format:check
```

Browser journeys use Playwright (the test command also builds and tests the Pages site at its repository subpath and the standalone HTML):

```sh
npx playwright install chromium
npm run test:e2e        # starts Vite automatically if needed
```

For an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its full executable path. On Linux, Playwright may need system browser libraries (`npx playwright install --with-deps chromium`). Browser tests cover clean first visits, preservation of real data during demo cleanup, planner deletion at desktop/tablet/mobile widths, and the exact two-player selection/refresh, three-player scheduling/draft restoration, four-person goalkeeper roster/diagram/selection, solo completion/progress, removal without history loss, mobile tabs/filters and the landing page, goals and refresh, tomorrow's plan/edit/completion, totals, repeated skill tests, challenge progress, favorite drills, backup/reset/restore, corrupted storage, navigation/layout at 320px, and analytics consent and event delivery. Screenshots and traces are generated in ignored paths. No lint command is configured; TypeScript and Prettier checks are provided.

For manual testing: start with an empty workspace, set a goal, plan tomorrow, edit it, mark it complete with actual minutes, and check Dashboard/Progress Tracker. Record two first-touch scores, start a relevant challenge and log eligible work, save a drill, refresh, then export/reset/import a backup. Also test the mobile menu, cancel destructive prompts, and close dialogs with Escape.

## Structure

- `src/model.ts`: types, seed data, statistics, challenge rules, backup validation.
- `src/drills.ts`: typed 60-drill catalog with stable IDs.
- `src/DrillFeatures.tsx`: catalog, details, diagrams, saved/current drill UI.
- `src/analytics.ts`, `src/AnalyticsConsent.tsx`, `public/analytics.html`: Google tag, consent and privacy controls, and the separate measurement document.
- `src/main.tsx`: app navigation, reusable UI, pages, forms, persistence.
- `src/style.css`: responsive visual system and original pitch graphics.
- `src/model.test.ts`, `tests/*.spec.ts`: domain, migration, catalog, regression, mobile, and standalone validation.
- `scripts/`: standalone HTML and GitHub Pages packaging.
- `docs/`: prebuilt GitHub Pages site, regenerated with `npm run build:pages`.

## Limitations

This prototype has no cloud sync, coaching assessment, calendar integration, reminders, multi-user collaboration, or cross-tab conflict resolution. Incomplete invalid form fields are not persisted as drafts. Performance results are optional free-text practice notes, not automatically parsed scores. Skill results can be removed and re-recorded; training logs can be edited directly. Challenges use date-based eligibility rather than an event audit trail. Very large histories are not paginated. The seven-day planner wraps into a compact grid on phones. Tested automated browser coverage uses Chromium; Safari/Firefox and assistive technology checks remain useful before wider launch.

Future work: test with 5–10 amateur players, learn which workflows they return to, improve accessibility with user feedback, add optional local reminders/templates.
