# Design reference

These nine files are the approved, clickable prototype screens, exported from Alex's design canvas. Each one is a 1280×800 screen.

| File | Screen |
|---|---|
| Main.dc.html | Home |
| Door.dc.html | Doorbell ring / door control |
| Cook.dc.html | Cook mode |
| Meals.dc.html | This week's meals |
| Recipes.dc.html | Recipe library |
| Calendar.dc.html | Family calendar (week) |
| Climate.dc.html | Two ecobee thermostats |
| Tasks.dc.html | Kids' tasks (Max, Lily) |
| TV.dc.html | TV control (two Chromecasts) |

**How to read them:**

- They won't render on their own. They depend on a design-tool runtime (`support.js`) that isn't included. Treat them as an exact spec, not code to ship.
- `{{name}}` marks a value computed in the `renderVals()` method of the `<script type="text/x-dc">` block at the bottom of each file.
- `<sc-for list=… as=…>` is a loop and `<sc-if value=…>` is a conditional.
- `<a href="X.dc.html">` means "navigate to screen X".
- Colors, font sizes, spacing, radii and copy are all inline styles. Copy them faithfully.
- The sample data inside each script (meals, events, tasks, channels) is placeholder content. Real data comes from Home Assistant; see HANDOFF.md §7.
- The dashed "Prototype: …" buttons on Home are for clicking through the prototype. Don't ship them.
