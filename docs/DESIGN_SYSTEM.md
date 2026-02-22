# Eventory Design System

**Single source of truth.** All UI must use these tokens and patterns. Implementation lives in `src/index.css`; this doc is the contract.

---

## 1. Color palette (light only)

**Coolors reference:** [0a33f9 · 4563cf · 8093a5 · bbc27b · f6f151](https://coolors.co/0a33f9-4563cf-8093a5-bbc27b-f6f151). App uses light theme with sage/cream; semantic tokens below.

| Token | Value | Use |
|-------|--------|-----|
| `--clr-bg` | #DBCEA5 | Page background |
| `--clr-surface` | #ECE7D1 | Cards, panels, inputs |
| `--clr-surface-hov` | #e0dcc4 | Hover state |
| `--clr-border` | #8A7650 | Borders, dividers |
| `--clr-txt` | #1a1d24 | Primary text |
| `--clr-txt-muted` | #5c6370 | Secondary text |
| `--clr-accent` | #6b7355 | Primary actions, active (sage) |
| `--clr-accent-hov` | #5a6247 | Accent hover |
| `--clr-accent-secondary` | #8E977D | Badges, secondary accent |
| `--clr-alert` | #b45309 | Warnings, at-risk |
| `--clr-success` | #1a9e4a | Success, on-track |
| `--clr-link` | #0a33f9 | Links (e.g. View on Map) |

**Rule:** Use semantic tokens (`--clr-*`), not raw palette in components.

---

## 2. Gradients

| Token | Value | Use |
|-------|--------|-----|
| `--gradient-card` | Soft sage/slate/yellow tint (160deg) | Main content bg, past event cards |

Other gradient variables in `:root` are palette-only; primary UI uses solid `--clr-accent` (no blue gradients on buttons/active states).

---

## 3. Typography

| Use | Font | Variable | Size | Where |
|-----|------|----------|------|--------|
| Body, inputs, buttons, labels | Inter | `--font-sans` | 14px default | Everywhere except headings |
| Headings, brand | Gamja Flower | `--font-header` | per element | h1–h6, sidebar "EVENTORY" |
| Monospace | SF Mono / Fira Code | `--font-mono` | — | Code if ever needed |

**Global:** `button, input, select, textarea` use `font-family: var(--font-sans)` only.

**Sidebar:** All text **14px**. No 11px/12px in sidebar. Classes: `.sidebar .nav-item`, `.sidebar-event-name`, `.sidebar-event-date`, `.sidebar-section-label`, `.sidebar-brand-name`, `.nav-item-count`, `.account-badge`.

**Sizes in app:**
- Sidebar / nav: 14px
- Body copy: 14px
- Overview labels: 12px (uppercase), values 14px
- Section titles: 16px; page titles 20px
- Status badge (on cards): 11px uppercase pill

---

## 4. Spacing & radius

| Token | Value | Use |
|-------|--------|-----|
| `--rad-base` | 12px | Cards, sections, modals |
| `--rad-sm` | 8px | Buttons, inputs, pills, toggles |
| `--btn-padding-y` | 10px | All action buttons |
| `--btn-padding-x` | 24px | All action buttons |
| `--btn-font-size` | 14px | All action buttons |

**Bottom padding:** `.event-overview` and `.event-overview-editable` use `padding-bottom: 80px` so there is space below notes / last field to the bottom of the page.

---

## 5. Theming

- **Light mode only.** No dark theme. All `--clr-*` variables are defined in `:root` for the light palette.
- **Active states:** Nav active, sidebar event active, view-mode active use **white text** on accent.
- **Priority/status labels:** Use solid backgrounds with contrasting text (e.g. `.task-priority-high` = dark brown bg + white text) so they remain visible on light surfaces—no orange on light blue.

---

## 6. Buttons

**Rule: every button has a solid background.** No outline-only or transparent-only primary actions.

| Class | Background | Text | Shadow / hover |
|-------|------------|------|----------------|
| `.btn-primary` | `--clr-accent`, hover `--clr-accent-hov` | #fff | Neutral shadow only: `0 2px 8px rgba(0,0,0,0.12)`, hover `0 4px 12px rgba(0,0,0,0.15)`. No blue shadow. |
| `.btn-secondary` | `--clr-surface` | `--clr-txt` | No shadow. |
| `.view-mode-btn` | `--clr-surface`, active `--clr-accent` | muted / #fff when active | Active: neutral shadow only. |

**Shadows:** All button and card hover shadows use **neutral** rgba(0,0,0,…). No blue-tinted shadows (no rgba(10, 51, 249, …)).

**Size:** All use `padding: var(--btn-padding-y) var(--btn-padding-x)`, `font-size: var(--btn-font-size)`. Icon + text: `display: inline-flex; align-items: center; gap: 6px`; **icon always left of text.**

---

## 7. Cards

- **Event cards:** `.event-card`. Border-left 3px `--clr-accent` (status color set inline for badges). No extra div bars (no border-top/border-bottom) around the Details/Tasks row.
- **Card actions:** One full-width row: `.event-card-view-toggle` with two `.view-mode-btn` (Detailed View | Tasks). Same look as full event page toggle; **no** separator line between or above them.
- **Past event cards:** `.past-event-card` — left border `--clr-border` (neutral). Background can use `--gradient-card` subtly.
- **Overview block on cards:** Only render when there is content (guest count, time, or date). If none, render nothing — no empty grey box.

---

## 8. Sidebar

- **Text:** All 14px (brand name, nav items, event names, dates, section label, Settings, account badge).
- **Alignment:** All text left (`text-align: left`, `justify-content: flex-start` where needed).
- **Active item:** Solid `--clr-accent`, white text, neutral shadow only. No blue/yellow borders; use background only.
- **Event names:** Full text visible; wrap if needed (no ellipsis chop).

---

## 9. Event overview & editor

- **Overview links:** Use `--clr-link`. Hover: `--clr-accent-secondary`.
- **No div bars in edit mode:** No `border-top` or `border-bottom` on:
  - `.event-overview-editor-container`
  - `.overview-editor-header`
  - `.editor-actions`
- **Bottom space:** `.event-overview` and `.event-overview-editable` have `padding-bottom: 80px`.

---

## 10. Event page headers

**Rule:** All full event pages (event detail, event tasks, agent category chat) must use the **same header pattern and position** so the layout and back navigation feel consistent. The header must not shift between "full event details" and "specific task/agent chat" views.

- **Wrapper:** Both `.event-chat-view` (full event) and `.agent-category-chat-view` (category chat) must include the class `.event-page`. This applies identical padding (`16px 24px 0 24px`) so the header sits in the same place on every event-related page.
- **Structure:** One row with class `.event-chat-header`: back button (`.agent-detail-back`), `h2` (event name), summary pill (`.agents-event-summary`: guests · time · date). Optional right-side elements: agent pill (e.g. `.event-chat-header-agent-pill` for category chat), primary action (e.g. `.event-chat-header-action` for Launch/Stop).
- **Back:** Always `.agent-detail-back`; same size and hover behavior.
- **Title:** `h2` with event name; 20px, font-weight 600, ellipsis if long.
- **Summary:** `.agents-event-summary` — same content everywhere: `{guests} guests · {start}-{end} · {date}`.
- **Extra pills/actions:** Same row, after the summary; use design tokens (e.g. agent pill uses agent color; action uses `.btn-primary`-style or `.event-chat-header-action`).

### Collapsible sections (app-wide)

**Rule:** Any collapsible section (Link Related Events, Tasks in category chat, Related tasks in linked-event modal, etc.) must use the **same toggle UI** so behavior and look are consistent.

- **Header:** A `<button type="button">` with class `.collapsible-toggle-header`. Same styles as `.linked-events-toggle-header`: flex row, space-between, 12px uppercase muted label, chevron on the right.
- **Label:** `<span className="collapsible-toggle-label">` for the title (e.g. "Tasks", "Link Related Past Events", "Related tasks (x/y done)").
- **Chevron:** Expanded = `ChevronUp`; collapsed = `ChevronDown` (or `ChevronRight` for "closed" state). Use class `.collapsible-toggle-chevron`.
- **Body:** When expanded, wrap content in `<div className="collapsible-section-body">` (margin-top 12px). Omit or hide when collapsed.
- **Usage:** Use wrapper class `.collapsible-section` on the parent. Link Related Events, category-chat Tasks, and linked-event modal "Related tasks" all use this pattern.

---

## 11. View mode (Details / Tasks)

- **Full event page:** `.view-mode-toggle` with two `.view-mode-btn`. Full width, single container border; no line between the two buttons.
- **Dashboard cards:** Same pattern (`.event-card-view-toggle` + `.view-mode-btn`). Clicking "Detailed View" or "Tasks" opens the event with that tab selected (`initialViewMode`).

---

## 12. Status & badges

- **Event status:** Use one source for labels (e.g. PLANNING, ON TRACK, AT RISK, COMPLETE). Badge: `.event-status-badge`; background/color set inline per status (solid color, white text).
- **Counts:** `.nav-item-count` — 14px, same as sidebar.

---

## 13. Forms & inputs

### Field layout
- **Structure:** Each field row uses `flex-direction: column; gap: 4px`.
- **Labels:** `.field-label` — 11px, uppercase, `--clr-txt-muted`, `letter-spacing: 0.03em`.
- **Hints / helper text:** Below the field (`.date-hint`), 11px, `--clr-txt-muted`.
- **Inputs:** `--clr-surface` bg, `--clr-border` border, `--rad-sm` radius, focus `border-color: var(--clr-accent)`.

### Option / chip selection (category, priority, etc.)
**Rule: selection is indicated by a border only.** Do not use a filled background for the selected option. Both category and priority pickers use the same pattern:
- **Unselected:** Default background and text for that option (e.g. category = `--clr-surface`, priority = its level color).
- **Selected:** Same background and text as unselected, plus **2px solid border in `--clr-accent`**. No filled accent background on the chip.
- **Implementation:** `.category-option.selected` and `.task-priority.selected` both use `border: 2px solid var(--clr-accent)`; base `.task-priority` uses `border: 2px solid transparent` so layout does not shift when selected.

### Priority picker
Use the existing `.task-priority` class with modifier classes (`.task-priority-high`, `.task-priority-medium`, `.task-priority-low`) for priority buttons in forms. Wrap in `.priority-picker` (inline-flex, gap 6px). Selected state: `.selected` adds **border only** (2px solid `--clr-accent`), same fill as unselected.

| Priority | Class | Background | Text |
|----------|-------|------------|------|
| High | `.task-priority-high` | #92400e | #fff |
| Medium | `.task-priority-medium` | #4b5563 | #fff |
| Low | `.task-priority-low` | #e5e7eb | #374151 |

**Rule:** Always show all three priority options (High, Medium, Low). The same `.task-priority` styles are used both in forms and in task list display — **no separate "picker" styles**.

### Category picker
Use `.category-picker` (flex, gap 6px) with `.category-option` buttons. Each shows icon + label. Selected state: **border only** (2px solid `--clr-accent`), same background and text as unselected.

- **Unselected:** `--clr-surface` bg, `--clr-border` border, `--clr-txt` text.
- **Selected:** Same bg and text; **2px solid `--clr-accent`** border only (no filled accent).
- **Hover:** `--clr-surface-hov` bg.

### Form actions (Cancel / Save)
- **Alignment:** Always `justify-content: flex-end` (buttons on right).
- **Order:** Cancel first, then primary action (Save, Add, etc.).
- **Classes:** Cancel = `.btn-secondary`; primary = `.btn-primary` or action-specific (e.g. `.btn-add-task`).

---

## 14. Back buttons

**Rule: all back arrows use `.agent-detail-back`.** Same class, same look everywhere.

| Property | Value |
|----------|-------|
| Size | 36×36px |
| Border | 1px solid `--clr-border` |
| Background | `--clr-surface` |
| Icon | `ArrowLeft` size 18 |
| Radius | `--rad-sm` |
| Hover | `color: --clr-txt`, `border-color: --clr-accent` |

**Usage:** Every page with a back arrow (event detail, task document, agent chat, settings) must use `<button className="agent-detail-back">`. No custom back button classes.

---

## 15. Chat / action buttons

**Rule: all "Chat" buttons use `.task-agent-group-action-btn` with a `MessageSquare` icon.**

| Property | Value |
|----------|-------|
| Display | `inline-flex`, `align-items: center`, `gap: 6px` |
| Padding | 6px 10px |
| Font | 12px, weight 500 |
| Background | `--clr-surface` |
| Border | 1px solid `--clr-border` |
| Radius | `--rad-sm` |
| Icon | `MessageSquare` size 14, left of text |
| Hover | `--clr-surface-hov` bg, `--clr-txt` color |
| Disabled | opacity 0.5, cursor not-allowed |

**Usage:** `<button className="task-agent-group-action-btn"><MessageSquare size={14} /> Chat</button>`. Used in task manager group headers, task document headers, and anywhere a "go to chat" action is needed.

---

## 16. Checklist for new or updated UI

- [ ] Only Inter and Gamja Flower; buttons/inputs use `var(--font-sans)`.
- [ ] Sidebar: all text 14px, left-aligned.
- [ ] Every button: solid background; icon left of text; same padding/font size for same action type.
- [ ] Links: `var(--clr-link)`.
- [ ] Active/selected: nav and primary buttons use accent background + white text; **option/chip selection (category, priority) uses border only** (2px solid `--clr-accent`), no filled accent on the chip.
- [ ] No div bars on edit event block (no border-top/border-bottom on editor header/actions/container).
- [ ] Overview/editor: 80px padding-bottom; overview block on cards only when there’s content.
- [ ] Cards: Details | Tasks full-width toggle, no separator line; status badge solid, white text.
- [ ] Hover on cards/nav: **neutral shadow only** (e.g. `rgba(0,0,0,0.12)`); no blue shadow, no blue/yellow borders.
- [ ] Event status labels from single source; same badge style everywhere.
- [ ] Event page headers: use `.event-chat-header` with back, h2, `.agents-event-summary`; optional agent pill and action on the right.
- [ ] Back buttons: always `.agent-detail-back` (36×36, bordered, ArrowLeft 18). No custom back button classes.
- [ ] Chat buttons: always `.task-agent-group-action-btn` with `MessageSquare` icon (size 14) left of "Chat" text. Same class everywhere.
- [ ] Form labels: `.field-label` (11px uppercase muted); hints below fields.
- [ ] Priority picker: reuse `.task-priority` + modifier classes; wrap in `.priority-picker`; selected = border only (2px solid `--clr-accent`).
- [ ] Category picker: `.category-picker` + `.category-option`; selected = border only (2px solid `--clr-accent`).
- [ ] Form actions: right-aligned (`justify-content: flex-end`); Cancel before Save.
