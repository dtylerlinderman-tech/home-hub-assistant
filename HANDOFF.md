# Kitchen Hub — Build Handoff for Claude Code

Owner: Alex · Prepared: October 20, 2026

You are building **Kitchen Hub**, a custom, fast, low-cost "Google Home"-style smart display for a family kitchen. The approved design is in `design/` as nine clickable prototype screens. This document says what to build, how it connects to each device, and in what order.

**How to work:**

- Read this whole file and every file in `design/` before writing code. `screens/` has PNG renders of every screen (and its key states) to use as the visual target.
- Build in the phases in §14, and check each phase's acceptance criteria before moving on.
- When something here is marked **VERIFY**, check it against current docs or the live Home Assistant instance before relying on it, and tell Alex what you found.
- Never invent entity IDs. Discover them from the Home Assistant API.
- Never commit secrets.

---

## 1. Goal and constraints

- **Now:** the app runs in a web browser (laptop or phone) on the home network. **Later:** the same build gets loaded onto an 11" Android tablet in kiosk mode, with no code changes.
- **Fast and bloat-free.** Small bundle, near-instant screen changes, no heavy UI frameworks, no Home Assistant Lovelace dashboards.
- **Minimize cost.** Free or open-source everywhere, except Nest Device Access ($5 one-time) and Fully Kiosk Plus (about $8, tablet phase only).
- **Primary viewport:** 1280×800 CSS px, landscape. It must also look right in a desktop browser. A phone layout (rail becomes a bottom tab bar, columns stack) is a nice-to-have for this phase.
- **Users:** Alex, Sam, and their kids Max and Lily. Kids use the Tasks screen, so touch targets must be large: at least 44 px, mostly 52–80 px as in the designs.

## 2. Architecture

```
┌──────────────────────── Old Lenovo Yoga laptop (24/7) ────────────────────────┐
│ Home Assistant OS                                                             │
│  ├─ Integrations: Nest (doorbell), Nest x Yale (HACS), ecobee ×2,            │
│  │   Google Calendar, Mealie, Waze Travel Time, Android TV Remote ×2,        │
│  │   Google Cast ×2, Met.no weather, Local To-do, (later) Fully Kiosk         │
│  ├─ Add-ons: Mealie, HACS, Samba share or SSH, Tailscale (optional)           │
│  ├─ Package: packages/kitchen_hub.yaml (helpers, scripts, automations)        │
│  └─ Serves the app as static files: /config/www/kitchen → /local/kitchen/     │
└───────────────────────────────────────────────────────────────────────────────┘
          ▲ WebSocket API (home-assistant-js-websocket), auth via HA login
          │
┌─────────┴──────────────┐
│ Kitchen Hub web app    │  Browser now → tablet in Fully Kiosk later
│ (static SPA)           │
└────────────────────────┘
```

**Key decision: all data goes through Home Assistant's WebSocket API.** That includes Mealie (via HA's Mealie integration actions), the calendar, weather, traffic, the lock, the doorbell, climate and TVs. Benefits:

- One connection and one login.
- No CORS problems.
- No extra server to run.
- No secrets in the frontend.

Service calls that return data use `call_service` with `return_response: true`.

## 3. Tech stack and repo layout

- **Vite + Preact + TypeScript.** Preact for a React-like component model at about 4 KB. Plain CSS with custom properties; no Tailwind or UI kits. Target a main bundle under 100 KB gzipped.
- **`home-assistant-js-websocket`** for the connection, auth (`getAuth` login redirect, tokens kept in localStorage), entity subscriptions and service calls.
- Icons: inline stroke SVGs copied from the design files.
- Font: Manrope. Self-host the woff2 files in the build so the tablet doesn't depend on Google Fonts.
- Tests: Vitest for logic (meal suggestion rules, timer parsing, school-run windows). Playwright smoke test that each screen renders in mock mode at 1280×800.

```
kitchen-hub/
  src/
    app.tsx              # shell: left rail, router, doorbell overlay listener
    screens/             # Home, Door, Cook, Meals, Recipes, Calendar, Climate, Tasks, TV
    components/          # Card, Rail, Stepper, Segmented, Toggle, Checkbox, PinPad, …
    data/
      adapter.ts         # DataAdapter interface
      ha-adapter.ts      # real Home Assistant implementation
      mock-adapter.ts    # mock data matching the prototype
    logic/               # mealRules.ts, timers.ts, schoolRun.ts (pure, unit-tested)
    config.ts            # loads /local/kitchen/config.json at runtime
    styles/tokens.css
  public/config.example.json
  ha/
    packages/kitchen_hub.yaml
    README-ha-setup.md   # step-by-step HA setup Alex follows
  scripts/deploy.sh      # build + copy dist to HA /config/www/kitchen
  .env.example           # HA_URL only; no tokens
```

## 4. Data adapter and mock mode (build this first)

Define a `DataAdapter` interface covering every read and action in §7. Then implement two versions:

- **`MockAdapter`:** reproduces the prototype's sample data and behavior: demo PIN 1234, a fake doorbell ring, simulated timers, and so on. Enable it with `?mock=1`, or automatically when no HA URL is configured.
- **`HaAdapter`:** the real implementation.

The whole UI can then be built and tested before Home Assistant is fully set up. Each feature switches to live data the moment its integration exists. If an entity in the config is missing, its card shows a quiet "Not connected" state instead of crashing.

## 5. Runtime config (`config.json`, served next to the app)

Everything household-specific lives here, so it can change without a rebuild. Example shape, using placeholder entity IDs. Discover the real ones and fill them in.

```json
{
  "haUrl": "http://homeassistant.local:8123",
  "timezone": "America/New_York",
  "weather": "weather.forecast_home",
  "people": { "Alex": "#6EA8E8", "Sam": "#E58FB5", "Kids": "#5FB3A6", "Family": "#E8A33D" },
  "calendars": [ { "entity": "calendar.family", "person": "Family" } ],
  "door": {
    "camera": "camera.front_door",
    "doorbellEvent": "event.front_door_chime",
    "lock": "lock.front_door",
    "unlockScript": "script.kitchen_unlock_front_door",
    "relockSeconds": 30
  },
  "climate": [
    { "name": "Downstairs", "entity": "climate.downstairs" },
    { "name": "Upstairs", "entity": "climate.upstairs" }
  ],
  "climatePresets": ["home", "away", "sleep"],
  "schoolRun": {
    "name": "Oak Hill School",
    "address": "2400 Old Alabama Rd, Roswell, GA 30076",
    "travelSensor": "sensor.waze_school_drive",
    "days": ["tue", "thu"],
    "dropoff": "09:00",
    "pickup": "14:00",
    "leaveBufferMin": 5,
    "dropoffWindow": ["07:00", "09:15"],
    "pickupWindow": ["12:30", "14:15"]
  },
  "tvs": [
    { "name": "Living room", "remote": "remote.living_room_tv", "player": "media_player.living_room_tv", "cast": "media_player.living_room_tv_cast" },
    { "name": "Bedroom", "remote": "remote.bedroom_tv", "player": "media_player.bedroom_tv", "cast": "media_player.bedroom_tv_cast" }
  ],
  "tvService": "YouTube TV",
  "favoriteChannels": [ { "name": "ESPN", "deepLink": "TBD" } ],
  "kids": [
    { "name": "Max", "color": "#6EA8E8", "todo": "todo.max_tasks" },
    { "name": "Lily", "color": "#B79CF0", "todo": "todo.lily_tasks" }
  ],
  "homeReminders": "todo.home_reminders",
  "mealie": { "configEntryId": "TBD", "mealTags": ["Weeknight", "Kids", "Grill", "Slow cooker"] },
  "notifyTarget": "notify.mobile_app_alexs_phone"
}
```

## 6. Home Assistant side (Claude Code writes these; Alex applies them)

Write `ha/packages/kitchen_hub.yaml` as a Home Assistant package, plus `ha/README-ha-setup.md` with click-by-click steps.

**Dedicated user:** create a non-admin Home Assistant user, `kitchen`, which the tablet and browser log in as.

**Front door unlock (PIN checked on the server, never in the browser):**

- `input_text.kitchen_door_pin` (mode: password), set by Alex in the UI.
- `script.kitchen_unlock_front_door`, which takes a `pin` field. It compares the PIN to the helper. On a match it calls `lock.unlock` on the front door and starts the relock timer. On a mismatch it fires a `kitchen_hub_bad_pin` event so the app can show "Wrong PIN".
- After 3 bad attempts in 5 minutes, lock the PIN pad out for 5 minutes. Track this with a counter helper and a timer helper.
- Automation: relock `relockSeconds` after an unlock done from the kitchen. The lock's own auto-lock setting remains the backstop.

**Kids' tasks:**

- Local To-do lists `todo.max_tasks` and `todo.lily_tasks`.
- Each item carries its section in the description: `section: morning|after_school|evening`. Optionally add `days: mon,tue…` for day-specific items.
- Automation at 4:00 AM: set every item on both lists back to `needs_action`.

**Home reminders:** Local To-do `todo.home_reminders`. This will later be fed by Alex's separate "home hub" project.

**Doorbell → tablet (tablet phase; write it now but leave it disabled):** when the doorbell event fires, call the Fully Kiosk integration to turn the screen on and bring the app to the front. The app's own doorbell listener handles navigation.

**Night mode (tablet phase):** turn the screen off 10 PM–6 AM unless motion is detected.

## 7. Screen-by-screen spec

The look, layout, copy and interactions must match `design/<Screen>.dc.html`. Below are data sources and actions only.

### Left rail (on every screen except Door and Cook)

Order: Home, Calendar, Meals, Recipes, Tasks, Climate, TV, then a spacer, then Door at the bottom. The Door icon is teal when locked and coral when unlocked.

### Home (`Main.dc.html`)

- **Clock and date:** local clock.
- **Weather:** the configured weather entity, plus `weather.get_forecasts` (daily) for the high and low.
- **Climate chips:** current temperature and status for each thermostat. Tapping opens Climate.
- **First column card is time-aware:**
  - School drop-off view on configured days inside the drop-off window.
  - School pick-up view inside the pick-up window.
  - Otherwise, Tonight's dinner.
  - Remove the dashed "Prototype: show…" buttons, but keep a `?scene=dropoff|pickup|dinner` URL override for testing.
- **School run:**
  - Drive minutes come from the Waze Travel Time sensor. Set the sensor up from `zone.home` to the school's address, and have the HA package's automation update it every 5 minutes during the windows.
  - "Usual" time is the average of the last 4 same-weekday readings inside the window. Use the HA recorder's statistics or history; until enough history exists, show nothing for "usual".
  - Leave-by = event time − drive minutes − buffer.
  - Traffic level from the delta: ≤2 min Light, ≤6 Moderate, more than that Heavy.
  - Map: embed the Waze live map iframe centered on the route. **VERIFY** the current Waze embed URL and its terms. If it isn't available, keep the stylized route graphic.
- **Tonight's dinner:** today's entry from `mealie.get_mealplan`. "Start cooking" opens Cook with that recipe.
- **Today:** today's events from `calendar.get_events` across the configured calendars, colored by person.
- **Now playing:** first TV that's on, showing app, channel or title, and live/paused. "Bedroom TV off" style note for the others. Hide the card if no TV is on.
- **Home reminders:** items from `todo.home_reminders`. Tap to complete.
- **Front door card:**
  - Latest camera snapshot, refreshed every 60 s while visible.
  - Lock state, how it was last operated, and battery, from the lock entity's attributes.
  - "View camera" and "Unlock" open the Door screen.

### Door (`Door.dc.html`)

- Opens automatically from any screen when the doorbell event fires, and stays on top until dismissed. It also opens from the rail.
- **Live view:** WebRTC stream from the Nest camera through Home Assistant's camera WebRTC WebSocket signaling. **VERIFY** the current message names. Fall back to an auto-refreshing snapshot if WebRTC fails.
- **Talk button:** remove it. Nest's Device Access API does not support two-way audio. **VERIFY**; if it does now, implement it.
- **Unlock:** calls `script.kitchen_unlock_front_door` with the PIN. The relock countdown comes from the HA timer helper. "Lock now" calls `lock.lock`. Remove the "Demo PIN" hint.

### Cook (`Cook.dc.html`)

- **Recipe:** fetch the full recipe (instructions and ingredients) for the chosen recipe. **VERIFY** whether HA's Mealie integration has a get-recipe action; if not, see §13.
- **Ingredients for each step:** use Mealie's per-step ingredient links when they exist. Otherwise, match ingredient names in the step text.
- **Timers:** parse durations from the step text ("20 minutes", "1 hr 15 min", "5–7 minutes", where a range uses the upper bound). Timers keep running across step changes and screen changes. When one finishes, show a full-screen alert with a sound, which needs a user gesture first to unlock audio.
- **Screen:** keep the screen on with the Screen Wake Lock API when available. On plain HTTP it won't be, and Fully Kiosk's keep-screen-on setting covers the tablet.
- Ingredient check-offs are per session and don't need saving.

### Meals (`Meals.dc.html`)

- **Week:** Monday–Sunday for the current week from `mealie.get_mealplan`. Dinner entries only.
- **Meal pool:** Mealie recipes with tags (Weeknight, Kids, Grill, Slow cooker) and total time. **VERIFY** how to list recipes through HA. If that isn't possible, see §13.
- **Suggestion rules:**
  - Quick weeknights: Mon–Thu, 35 min or less.
  - Grill Saturday.
  - Slow cooker Sunday.
  - Leftovers Wednesday.
  - No repeats within the week; prefer meals not used the previous week.
  - Implement in `logic/mealRules.ts` as pure functions with tests.
  - Save rule on/off states in `input_boolean` helpers so they stay in sync between devices.
- **Suggest a new week / swap one day:** run the rules, then write the plan with `mealie.set_mealplan` (or `update_mealplan`).
- **Grocery list:** build it from the week's recipes' ingredients, add it to Mealie's shopping list (exposed in HA as a `todo` entity), and send a summary to `notifyTarget`.

### Recipes (`Recipes.dc.html`)

- Search and category chips over the Mealie recipe list. Recipe photos come from Mealie.
- **Add from a link:** `mealie.import_recipe` with the URL, then open the new recipe.

### Calendar (`Calendar.dc.html`)

- Week view, Monday–Sunday, with previous/next week buttons and a Today button.
- Events from `calendar.get_events` for all configured calendars, colored by person.
- Each day shows its dinner from the meal plan.

### Climate (`Climate.dc.html`)

- Ecobee thermostats through HA's `ecobee` integration. It signs in with ecobee username and password; no developer key is needed since HA 2026.3.
- **Set temperature:**
  - Heat and Cool: −/+ adjusts the single target with `climate.set_temperature`.
  - Auto (`heat_cool`): show the range as "68–74°" and have −/+ shift both ends, keeping the minimum gap.
  - Debounce for 800 ms so repeated taps send one call.
- **Mode:** `climate.set_hvac_mode`. **Fan:** `climate.set_fan_mode`.
- **Whole-house Home / Away / Sleep:** `climate.set_preset_mode` on both thermostats. **VERIFY** the preset names the ecobee integration exposes.
- Status (Heating to / Cooling to / Idle) comes from `hvac_action`.

### Tasks (`Tasks.dc.html`)

- One column per kid, from that kid's To-do list, grouped by the section in each item's description.
- Hide items whose `days` don't include today.
- Tapping updates the item's status, with an optimistic UI update.
- Show the progress bar and the "All done today" banner as designed. A small celebration animation is fine; no sounds.

### TV (`TV.dc.html`)

- **Integrations:** Android TV Remote (power, volume, keys, launching apps and deep links) plus Google Cast (now-playing metadata), for each Chromecast with Google TV.
- **Now playing:** app name always. Title and artwork when the Cast player provides them.
- **Channel up/down:** `remote.send_command` with `KEYCODE_CHANNEL_UP` / `KEYCODE_CHANNEL_DOWN`. **VERIFY** on the real TV with the actual live-TV app.
- **Favorites:** launch each channel's deep link through the Android TV Remote player's play-media action. Deep links depend on the live-TV service (YouTube TV is assumed but unconfirmed). Ask Alex for the service and channel list.
- **Volume, mute, play/pause and power:** standard media_player actions.

## 8. Design tokens (from the prototype)

```css
--bg: #1B1A17; --rail: #141310; --surface: #26241F; --raised: #312E28;
--border: #2E2B26; --border-strong: #3A362F;
--text: #F4EFE6; --muted: #A8A196; --subtle: #8C867B; --text-soft: #D6D0C4;
--accent: #E8A33D; --accent-tint: #2E2619;      /* text on accent: #1B1A17 */
--ok: #5FB3A6; --ok-tint: #1F3330;
--alert: #F07A60; --alert-text: #F59A85; --alert-tint: #3A1D17;
--cool: #8EBDF0; --cool-tint: #1C2A3A;
--radius-card: 24px; --radius-control: 16–18px;
font-family: Manrope (400–800); tabular numerals for clocks, temperatures and timers.
```

There is a dark theme only for now. Use the type sizes and spacing exactly as in the design files.

## 9. Deployment

- `npm run build`, then `scripts/deploy.sh` copies `dist/` and `config.json` to the Home Assistant machine's `/config/www/kitchen/`, using the Samba share or SSH add-on.
- Open `http://homeassistant.local:8123/local/kitchen/index.html` and sign in as the `kitchen` user.
- Files under `/local/` can be read by anyone on the home network. The app contains no secrets; all data access needs the HA login. Keep it that way.
- Add a web app manifest and icons so "Add to Home Screen" opens full-screen on phones and tablets. A service worker is optional and must never cache API responses.

## 10. Use from outside the house (optional)

Use the free **Tailscale** add-on. It gives Alex's phone access to the app and Home Assistant from anywhere, with no open ports. Nabu Casa ($65/year) is the paid alternative. Don't expose port 8123 to the internet.

## 11. Tablet phase (later; document it now, build nothing extra)

Write `ha/README-tablet.md` covering:

1. Turn on the tablet's battery charge limit (about 85%) and remove preinstalled apps over ADB.
2. Install Fully Kiosk Browser (Plus license), set the start URL to the app, enable keep-screen-on, and enable motion detection to wake the screen.
3. Add the Fully Kiosk integration to Home Assistant, then enable the disabled automations from §6.

The app should run the same in the tablet's browser as on a laptop.

## 12. Steps only Alex can do (keep this checklist in `ha/README-ha-setup.md`)

1. Install Home Assistant OS on the Lenovo Yoga: wipe Windows, wired Ethernet through a USB adapter, battery conservation mode turned on first.
2. Create the `kitchen` user. Set the door PIN in `input_text.kitchen_door_pin`.
3. **Nest doorbell:** sign up for Google Device Access ($5) and set up the Google Cloud project, OAuth and Pub/Sub as HA's Nest guide describes.
4. **Nest x Yale lock:** install HACS, then the `krozgrov/ha-nest-yale-integration` custom integration. Sign in with the token URL and cookies copied from the browser. Don't paste those into chats or repos.
5. **Ecobee:** add the integration and sign in with the ecobee account.
6. **Google Calendar:** add the integration and choose the family calendars.
7. **Mealie:** install the add-on, create an API token, add HA's Mealie integration, and load recipes. Tag each with Weeknight, Kids, Grill or Slow cooker, and make sure total time is filled in.
8. **Waze Travel Time:** create the school-run sensor.
9. **TVs:** add Android TV Remote (pair on each TV) and Google Cast.
10. **Phone:** install the HA Companion app so `notify.mobile_app_*` exists.

## 13. Open items (ask Alex; don't guess)

- **Recipe access through HA:** if HA's Mealie actions can't list recipes or fetch full recipe details, fall back to Mealie's REST API. Either configure Mealie's allowed CORS origins for the HA host, or proxy the calls through HA `rest_command`s. Pick one and explain why.
- **School run:** confirm drop-off and pick-up times and the leave buffer. 9:00 and 2:00 are taken from the school's listed 9–2 hours.
- **Thermostats:** confirm the real zone names and the Home/Away/Sleep temperatures.
- **TV:** which live-TV service, and which favorite channels.
- **Kids:** the real task lists for Max and Lily, and any day-specific tasks.
- **Meals:** the family's real meal list.
- **Front door card:** whether to show the doorbell's last-motion time; this depends on the events the Nest integration provides.

## 14. Build phases and acceptance criteria

1. **Scaffold + mock mode.** All nine screens built from the designs using `MockAdapter`, with working navigation, a mock doorbell takeover, and timers.
   *Done when* Playwright screenshots at 1280×800 match the design files closely, every interactive control works in mock mode, and the bundle is under 100 KB gzipped.
2. **HA connection.** `HaAdapter` with login, reconnect, entity subscriptions, config loading, and the "Not connected" states.
   *Done when* the app logs in as `kitchen` and shows live clock, weather and calendar.
3. **HA package.** `kitchen_hub.yaml`, the setup README, the PIN script, helpers and automations.
   *Done when* the PIN script unlocks only with the correct PIN, locks out after repeated failures, and relocks on time.
4. **Device features, one at a time:** Calendar → Climate → Tasks → Reminders → Meals/Recipes/Cook (Mealie) → School run (Waze) → TV → Door (lock, then camera and doorbell).
   *Done when* each one works against the real device and handles the device being offline.
5. **Polish.** Error toasts, loading skeletons, web app manifest, deploy script, and the tablet README.

## 15. Known limitations to state plainly in the UI or docs

- Nest camera video goes through Google's cloud, so it lags 1–3 s.
- The Nest x Yale lock uses an unofficial integration. If Google changes something it may stop working, and the tablet's lock buttons would need to show "Unavailable" when it does.
- Two-way talk with the doorbell isn't available (see Door).
- Some TV apps don't share titles or artwork, so Now Playing may show only the app name.
