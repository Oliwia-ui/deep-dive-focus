# Design references

These artifacts establish the visual and interaction direction for QuestLog and Deep Dive. They are references for implementation rather than separate production applications.

## 1. QuestLog interface wireframe

**File:** `01-questlog-wireframe.html`

This high-fidelity desktop mockup established:

- An Operate-oriented three-column composition: navigation, quest list, and persistent editor.
- A balance between the Enchanted Archive theme and familiar task-management language.
- Explicit urgency treatment for due-today, overdue, and important quests.
- A visible but secondary stable task reference for connecting a quest to Deep Dive.
- Separate visibility for local persistence and Obsidian logging status.

It prevented the fantasy direction from becoming a decorative book interface that obscured basic task actions.

## 2. Deep Dive timer and surface-decision mockup

**File:** `02-deep-dive-timer-mockup.html`

This interactive mockup established:

- A Monitor-oriented composition with the remaining time as the dominant reading.
- A combined meter-like focus-depth scale and named underwater zones.
- Diver ascent as a visualization of timestamp-derived progress rather than the authoritative clock.
- Separate planned, actual-focused, and paused durations.
- A deliberate surface decision with Complete Dive, Start Surface Break, Stay Below, and Cancel Dive.
- A calm underwater atmosphere without a score, streak, or distracting game economy.

It resolved the critical rule that reaching zero must not automatically claim that a session was completed.

## 3. Shared design-system study

**File:** `03-shared-design-system-study.html`

This comparison established:

- Shared spacing, control dimensions, state logic, accessibility rules, and interaction hierarchy.
- A warm parchment/archive skin for QuestLog and a low-glare marine/instrument skin for Deep Dive.
- Consistent primary, secondary, quiet, warning, and danger actions across both products.
- Different display typography while preserving readable body copy and factual labels.
- Motion as short feedback that can be reduced or disabled.
- Original visual motifs rather than copied franchise or product identities.

It confirmed that the apps can feel related in quality and behavior without appearing identical.

## Verification

All three artifacts were opened in a local browser on September 25, 2026. Their principal states and interactions rendered correctly, and no browser console errors or remote dependencies were detected.
