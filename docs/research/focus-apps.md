# Competitor research: offline student focus timer

**Research date:** 2026-09-25  
**Scope:** Current desktop-capable Pomodoro and time-tracking products relevant to a small, student-focused, offline-first timer. Primary sources were preferred; unsupported behavior is marked as unknown rather than assumed.

## Executive findings

- The strongest two-day product slice is **a reliable session state machine plus honest logging**, not a broad task manager: start, pause/resume, stop/cancel, complete, configurable focus/break durations, one task/description/link, and a review list.
- **Planned duration and actual elapsed duration must be separate fields.** A 25-minute target is not proof that 25 minutes were worked. Toggl and Clockify demonstrate this separation by combining a Pomodoro interval with independently running time entries; Super Productivity exposes both `durationMs` and `elapsedMs`.
- “Works offline” has several meanings. Super Productivity and ActivityWatch are genuinely local-first; Toggl and Clockify cache some work locally but remain cloud-oriented and restrict offline history/context. Pomofocus offers desktop downloads, but its official pages do not establish offline behavior or local-only storage.
- Competitors validate task context and review/history, but integrations, team administration, billing, passive surveillance, cross-device sync, and elaborate analytics are over-scoped for a two-day student project.

## Comparison

| Application | Essential focus behavior | Task/context and review | Planned duration vs actual elapsed | Offline/local persistence | Fit and scope judgment |
|---|---|---|---|---|---|
| **Pomofocus** | Custom focus/break durations; timer and break loop; task selection. Official instructions mention starting a 25-minute timer, but do not document pause, cancellation semantics, or partial-session accounting. | Daily tasks, estimated Pomodoros, templates, visual daily/weekly/monthly reports; projects, yearly reports and CSV are premium. | **Planned:** per-task estimated Pomodoros and configurable timer length. **Actual:** reports claim “focus time,” but the official page does not explain whether interrupted/partial sessions count or whether elapsed time is stored independently. Treat as unknown. | Desktop downloads exist for macOS, Windows and Linux, but no official offline guarantee was found. Privacy policy permits cookies, usage collection, advertising partners and data transfer to Japan; therefore “desktop” must not be inferred to mean local-only/private. | Closest UI benchmark. Copy its low-friction task + timer flow, not premium projects/integrations/templates for v1. |
| **Toggl Track** | Desktop Pomodoro settings allow configurable work intervals, optional break tracking and break duration. Continue/stop shortcuts and editable timer/manual entries exist. | Descriptions/time entries, projects and calendar/list views; broader reports live in the cloud/web product. | **Planned:** Pomodoro interval. **Actual:** a time entry runs independently; at the end of a work interval, **Continue** continues the running entry, and after a break it restarts the last entry. Actual tracked duration can therefore differ from the plan. | Desktop stores offline data locally and uploads it when connected. However, web offline mode is limited to Timer; reports, project management and settings are unavailable offline. This is offline caching, not local-first ownership. | Strong model for actual-duration tracking and idle correction. Team billing, rates, clients and cloud reporting are unnecessary. |
| **Clockify** | Start/stop and manual time entry; configurable Pomodoro and breaks; desktop notifications prompt the user when the interval ends. Breaks can have their own timer. | Description, project, task, tags and detailed/summary/weekly reports; detailed exports include start, end and duration. | **Planned:** Pomodoro interval. **Actual:** the Pomodoro primarily notifies the user to stop the current tracking timer; time entries have independent start/end/duration and can be edited. Do not equate the notification threshold with elapsed work. | Desktop can create/start/stop entries offline and saves unsynced entries locally. Limits: only unsynced offline entries are visible; projects/tasks/tags are unavailable; logging out before sync loses unsynced data. | Useful negative example: “offline” can still be fragile and incomplete. Avoid workspaces, approvals, screenshots, expenses, invoicing, team reports and automatic activity capture. |
| **Super Productivity** | Start/pause a timer from tasks; Pomodoro, countdown and Flowtime modes; configurable focus/short/long breaks; skip/extend behavior; session review and summaries. | Tasks/subtasks, notes, links/bookmarks, projects, tags, estimates, daily/weekly summaries and exports. | **Explicit separation:** official REST API exposes `durationMs`, `elapsedMs`, `remainingMs`, status and overtime. Product pages also compare estimates with tracked actual time. This is the clearest precedent for our data model. | No account required; desktop works offline and stores app data, settings and time-tracking state in local Electron data/IndexedDB, with local JSON backups and optional sync. | Best architectural benchmark, but far too broad: boards, planner, metrics, plugins, mobile, sync, backups, GitHub/Jira/GitLab and theming are not two-day features. |
| **ActivityWatch** | No Pomodoro session lifecycle. It passively records active applications/browser tabs and AFK status. | Dashboard, timeline, categories, historical activity browser, raw data and JSON export; not centered on user-declared study tasks. | **Actual only:** timestamped activity/heartbeat events and AFK filtering estimate what happened. It does not supply a planned focus duration. | Strong local-first precedent: usage data is stored locally, developers cannot access it, no external transmission or third-party analytics; cross-platform desktop app. | Useful disconfirming competitor: precise passive data does not replace intentional focus sessions. OS watchers, browser history capture, category rules and query APIs are privacy-sensitive and over-scoped. |

## Essential, useful, and unnecessary features

### Essential for the two-day build

1. **Explicit session lifecycle:** idle → running → paused → completed or cancelled/stopped.
2. **Configurable planned duration:** focus and break lengths; sensible defaults.
3. **Actual elapsed measurement:** accumulate only running time, excluding paused time; derive from timestamps rather than decrementing a counter as the sole truth.
4. **Task context:** short description plus optional URL/Obsidian note link or course reference.
5. **Break transition:** offer a break after completion; never silently rewrite the focus session as its planned duration.
6. **Completed-session review:** newest-first local list showing status, planned duration, actual duration, task and timestamps.
7. **Offline persistence and append-only Markdown events:** persist active state locally and append start/completion/cancellation records to an Obsidian-compatible `.md` log.

### Useful if the core is complete

- Resume recovery after app restart, based on stored timestamps and prior state.
- Overtime display when actual elapsed exceeds planned duration.
- One-click repeat of a prior task/session.
- Long break after a configurable number of completed focus sessions.
- Daily totals split by **completed**, **cancelled** and **actual focused minutes**.
- Manual correction with an audit note rather than destructive history editing.
- Lightweight idle prompt after a large inactivity gap; do not attempt ActivityWatch-style continuous surveillance.

### Unnecessary or over-scoped for two days

- Accounts, cloud sync, collaboration, teams, clients, billing, rates, invoices or approvals.
- Full projects/tags/boards/calendar/task hierarchy.
- Passive app/URL tracking, screenshots, keyboard/mouse watchers or productivity scoring.
- Mobile apps, browser extensions and cross-device synchronization.
- Third-party task imports, webhooks and Jira/GitHub/Todoist integrations.
- Complex analytics, CSV/PDF exports, themes, plugins, templates and gamification.

## Disconfirming evidence and cautions

- **Offline marketing can overstate reality.** Super Productivity’s own comparison page says Toggl and Clockify lack offline support and Pomodoro mode, but Toggl and Clockify’s official documentation explicitly describes both. Use first-party operational documentation over competitor comparison tables.
- **A finished countdown is not verified work.** Clockify’s Pomodoro can be a notification layered over a separate running entry; Toggl lets a work entry continue beyond the Pomodoro boundary. Logging the configured target as actual time would create false data.
- **Local caching is not local-first.** Toggl uploads cached entries when reconnected. Clockify hides previously synced history and task metadata offline, and can lose unsynced entries on logout. Our build can offer a simpler but stronger guarantee by keeping the whole review history usable without a network.
- **More detailed tracking can reduce student fit.** ActivityWatch captures rich actual activity, but it lacks intentional task goals and introduces sensitive window titles/URLs. A student focus tool should ask what the student intends to study and record only the session data needed.
- **Desktop packaging does not prove offline/privacy behavior.** Pomofocus publishes desktop builds, while its privacy policy still documents usage data, cookies and advertising partners. Offline/local behavior remains unverified.

## Established facts vs inferences

### Established by primary sources

- Pomofocus supports tasks, Pomodoro estimates, customizable focus/break settings, reports and downloadable desktop builds.
- Toggl and Clockify desktop apps support Pomodoro/break settings and some offline time capture, while retaining cloud synchronization and offline limitations.
- Super Productivity works offline without an account, stores desktop data locally, links timers to tasks, and exposes planned (`durationMs`) and actual (`elapsedMs`) timer values separately.
- ActivityWatch stores computer-usage data locally and provides timestamped activity data, dashboards, timelines and export.

### Inferences for this project

- A trustworthy student log should use **actual elapsed running time** as the review/reporting metric and retain planned duration only as the student’s intention.
- Append-only Markdown is a practical differentiator: it is transparent, inspectable, easy to back up, and naturally compatible with Obsidian without implementing cloud sync.
- Cancellation should be a first-class outcome rather than deletion. Interrupted sessions are useful evidence for reflection and prevent totals from being inflated.
- The highest-value custom feature is an **honest session receipt**: planned vs actual, pause time, completion/cancellation reason, task/link and event timestamps in one readable entry.

## Concrete implications for our build

### Minimal data model

```ts
type SessionStatus = "running" | "paused" | "completed" | "cancelled";

type FocusSession = {
  id: string;
  kind: "focus" | "break";
  status: SessionStatus;
  task: string;
  link?: string;
  plannedDurationMs: number;
  actualElapsedMs: number;
  startedAt: string;
  endedAt?: string;
  pausedAt?: string;
  accumulatedPauseMs: number;
};
```

### Logging contract

Append an event immediately on **start**, **completion**, and **cancellation**. Never replace an earlier event. Completion/cancellation must include both planned and actual duration. A compact Obsidian-friendly format could be:

```md
- 2026-09-25T14:00:00+02:00 | START | session: abc123 | task: Read chapter 4 | planned: 25m | link: [[Course Notes]]
- 2026-09-25T14:22:31+02:00 | CANCEL | session: abc123 | actual: 18m42s | planned: 25m | reason: class started
```

### Product choices

- Keep focus and break sessions distinct; do not count break time as study time.
- On countdown zero, show **Complete / Continue / Start break**. Continuing should increase actual elapsed and mark overtime instead of silently opening a new “25-minute” record.
- On Stop, require or offer **Complete** vs **Cancel** so the log communicates intent.
- Store current session state and review history locally; the app must remain fully usable offline.
- Use filesystem append for the Markdown log where the desktop shell permits it; use a safe local database/store for recoverable UI state. Rebuildable review data may be derived from the local store, but the Markdown log remains append-only.

## Dated primary source list

All sources accessed **2026-09-25**.

### Pomofocus

1. [Pomofocus home, workflow, features and desktop downloads](https://pomofocus.io/) — tasks, estimates, reports, settings, premium scope, desktop packages.
2. [Pomofocus Privacy Policy](https://pomofocus.io/privacy) — usage data, cookies, advertising partners and international transfer.

### Toggl Track

3. [Toggl Track desktop app for macOS](https://support.toggl.com/en-us/article/toggl-track-desktop-app-for-macos-1669b8x/) — local offline caching, entry management and desktop behavior.
4. [Can Toggl Track work offline?](https://support.toggl.com/en-us/article/can-toggl-track-work-offline-4r4tcw/) — timer-only web offline mode and unavailable reports/project management; page updated 2026-06-16.
5. [Toggl Track desktop app for Windows](https://support.toggl.com/en-us/article/toggl-track-desktop-app-for-windows-5w1y5/) — Pomodoro work/break behavior, continue/stop shortcuts and idle handling.

### Clockify

6. [Clockify Windows desktop app](https://clockify.me/help/apps/windows-desktop-app) — timer/manual entries, Pomodoro/break flow, offline storage and limitations.
7. [Clockify Pomodoro, idle detection and reminders](https://clockify.me/help/track-time-and-expenses/idle-detection-reminders) — supported platforms, configurable intervals and notification behavior.
8. [Clockify detailed report](https://clockify.me/help/reports/detailed-report) — entry fields including description, task, start/end and duration.
9. [Clockify plans and pricing](https://clockify.me/pricing) — current commercial breadth and plan structure.

### Super Productivity

10. [Super Productivity official site](https://super-productivity.com/) — offline/no-account positioning, focus, tasks, tracking, summaries and integrations.
11. [Super Productivity Pomodoro feature page](https://super-productivity.com/use-cases/pomodoro/) — task-linked sessions, configurable breaks, review, overtime/continue choices and local offline operation.
12. [Super Productivity time-tracker page](https://super-productivity.com/use-cases/time-tracker/) — pause, estimates vs actual, summaries and exports; also the contradicted competitor comparison claims.
13. [Super Productivity official repository](https://github.com/super-productivity/super-productivity) — open-source feature set, local/privacy claims and integration breadth.
14. [Super Productivity Local REST API](https://github.com/super-productivity/super-productivity/blob/master/docs/wiki/3.01-API.md) — explicit `durationMs`, `elapsedMs`, `remainingMs`, timer status and overtime fields.
15. [Super Productivity user-data documentation](https://github.com/super-productivity/super-productivity/blob/master/docs/wiki/3.06-User-Data.md) — desktop data folders, IndexedDB/localStorage, backups, exports and optional sync.

### ActivityWatch

16. [ActivityWatch official repository](https://github.com/ActivityWatch/activitywatch/) — local storage, watchers, timestamped events, dashboards/timelines and JSON export.
17. [ActivityWatch Privacy Policy](https://docs.activitywatch.net/en/latest/privacy.html) — local-only usage data, no developer access, no external transmission and no third-party analytics.
18. [ActivityWatch exporting data](https://docs.activitywatch.net/en/latest/features/exporting-data.html) — raw local bucket export and REST API export.
