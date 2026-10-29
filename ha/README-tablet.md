# Kitchen Hub on the tablet

Getting the hub onto the 11" Android tablet in the kitchen, running full-screen in Fully Kiosk Browser.
Work through the parts in order. Each one ends with a **Check**.

**Time:** about an hour, plus the tablet's own first-run updates.

---

## Contents

1. [Before you start](#1-before-you-start)
2. [Pin down Home Assistant's address](#2-pin-down-home-assistants-address)
3. [Put the app on Home Assistant](#3-put-the-app-on-home-assistant)
4. [Set up the tablet](#4-set-up-the-tablet)
5. [Fully Kiosk Browser](#5-fully-kiosk-browser)
6. [Sign in](#6-sign-in)
7. [Connect the tablet to Home Assistant](#7-connect-the-tablet-to-home-assistant)
8. [Updating the app later](#8-updating-the-app-later)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Before you start

**The tablet:** Android, about 11", with a **1920 × 1200** screen (for example a Samsung Galaxy Tab A9+). The hub is laid out for 1280 × 800, which is exactly what a 1920 × 1200 Android tablet shows at its normal zoom. Fully Kiosk is Android-only, so not an iPad.

**Power:** it stays plugged in all the time. Plan the mount around an outlet or a long USB-C cable.

**Decide about the `kitchen` user.** The original plan made it a non-admin user, which is safer for a screen anyone in the kitchen can touch. One feature needs admin: the "Lock needs to sign in again" message on the Front Door card reads integration status, which only admins can see. As non-admin, that case just shows "Unavailable". Everything else works either way. Change it under **Settings → People → kitchen → Administrator**.

## 2. Pin down Home Assistant's address

The tablet loads the app from Home Assistant's IP address (`http://192.168.68.67/…`, the wired address, since October 2026). If that address changes, the tablet shows a blank page.

1. If the Yoga is moving upstairs onto Ethernet, **do that first**. Its address will change when it does.
2. In the **Deco app**: **More → Advanced → Address Reservation** → **Add** → choose the Home Assistant machine → keep the address it has now → **Save**.
3. Once the tablet is on Wi-Fi (Part 4), reserve its address the same way. Home Assistant talks to Fully Kiosk by IP.

**Check:** in the Deco app the reservation is listed, and `http://192.168.68.67` still opens Home Assistant.

If the address did change: update `VITE_HA_URL` in `.env.local` on the laptop, and the start URL in Fully Kiosk (Part 5). The deployed app itself follows whatever address it was loaded from.

## 3. Put the app on Home Assistant

The app is plain files in `/config/www/kitchen/` on the Yoga, which Home Assistant serves at `/local/kitchen/`. The deploy script builds it and copies it there over the **Samba share** app.

**Samba share** (one time; see Part 6 of [README-ha-setup.md](README-ha-setup.md#6-file-access-and-packages)): **Settings → Apps → App Store → Samba share → Install**, set a username and password on its Configuration tab, then **Start** and turn on **Start on boot**. If the install fails with a download timeout (Docker Hub), wait a while and try again.

On the laptop:

1. In File Explorer, open `\\192.168.68.67\config` once and sign in with the Samba username and password. Tick **Remember my credentials**.
2. In the project folder, run:

   ```bash
   npm run deploy
   ```

   It builds the app and copies it, `public/config.json` and your background photo to `\\192.168.68.67\config\www\kitchen`. The full-size original photo stays on the laptop.

**Check:** on the laptop, open `http://192.168.68.67/local/kitchen/index.html`. You get the Home Assistant sign-in, then the hub with live data.

**No Samba?** You can upload the contents of the project's `dist/` folder (after `npm run build`) with the **File editor** app's upload button into `/config/www/kitchen/`, keeping the `assets`, `img` and `backgrounds` subfolders. It works, but it's slow, so Samba is worth the retry.

## 4. Set up the tablet

1. Finish Android's first-run setup and install all system updates. Connect to your normal Wi-Fi; 5 GHz is fine.
2. **Battery protection:** Samsung: **Settings → Battery → More battery settings → Protect battery** (stops charging at 80–85%). Other brands have a similar setting. A tablet charging at 100% around the clock swells its battery within a year or two.
3. **Display:** **Settings → Display** → brightness about 70%, and turn off **Adaptive brightness** if the kitchen lighting makes it jump around. Leave the screen timeout alone; Fully Kiosk handles it.
4. **Optional:** uninstall or disable apps you won't use (games, the brand's store, news apps). This is less clutter and fewer pop-ups over the hub. Advanced users can remove the rest over ADB; it isn't required.

**Check:** the tablet is updated, on Wi-Fi, and its address is reserved in the Deco app (Part 2, step 3).

## 5. Fully Kiosk Browser

1. Install **Fully Kiosk Browser** from the Play Store.
2. Buy the **Plus** license (about $8) inside the app: **Settings → Other settings → Fully Plus license**. Kiosk lock, motion detection and remote admin need it.
3. Settings to change (open **Settings** by swiping in from the left edge):

| Where | Setting | Value |
|---|---|---|
| Web content settings | Start URL | `http://192.168.68.67/local/kitchen/index.html` |
| Web content settings | Autoplay videos | On (the doorbell's live view) |
| Web auto reload | Auto reload on network reconnect | On |
| Web auto reload | Auto reload after page error | On |
| Device management | Keep screen on | On |
| Device management | Launch on boot | On |
| Device management | Screen orientation | Landscape |
| Toolbars & appearance | Show status bar / navigation bar | Off (full screen) |
| Screensaver | Screensaver | **Off.** The hub has its own photo frame |
| Motion detection (Plus) | Enable visual motion detection | On (front camera) |
| Motion detection (Plus) | Turn screen on on motion | On |
| Remote administration (Plus) | Enable remote administration | On, with a password you'll give Home Assistant in Part 7 |
| Kiosk mode (Plus) | Enable kiosk mode | On, with an exit PIN you'll remember |

**Check:** after a reboot, the tablet opens straight into the hub, full screen, landscape, with no Android bars.

## 6. Sign in

1. The first time, the hub shows the Home Assistant sign-in. Sign in as **`kitchen`** and tick **Keep me logged in**.
2. The hub remembers the sign-in. If you ever clear Fully's cache or data, you'll sign in once more.

**Check:** the Home screen shows the clock, temperatures, weather and the Front Door card with live data. After about 3 minutes without a touch, your family photo fades in; a tap brings the dashboard back.

## 7. Connect the tablet to Home Assistant

This lets the doorbell wake the screen, and lets the screen sleep overnight.

1. **Settings → Devices & services → Add integration → Fully Kiosk Browser.** Enter the tablet's IP address and the remote admin password from Part 5 (port 2323, SSL off).
2. The tablet appears as a device (ours: **TCL Tab 8 Gen2**, entities `switch.tcl_tab_8_gen2_screen`, `button.tcl_tab_8_gen2_bring_to_foreground`, `number.tcl_tab_8_gen2_screen_off_timer`). If yours are named differently, change them in the "Tablet" section near the end of `/config/packages/kitchen_hub.yaml`.
3. In Fully: **Motion Detection (Plus) → Turn screen on on motion** on. The integration has no motion sensor, so night mode leans on Fully: at 10 PM Home Assistant sets Fully's screen-off timer to 2 minutes, Fully wakes the screen when someone walks up, and at 6 AM the timer goes back to "never".
4. **Settings → Tools → YAML → Check configuration**, then **Reload → Automations**. The three **Kitchen Hub (tablet)** automations are on as soon as they load.

**Check:** turn the screen off from the device page in Home Assistant, then ring the doorbell. The screen comes on with the doorbell view. After 10 PM, the screen goes dark after 2 idle minutes and comes back when you walk up.

## 8. Updating the app later

1. On the laptop: `npm run deploy`.
2. Reload the tablet: in Home Assistant, open the Fully Kiosk device and press **Clear browser cache**, then **Load start URL**. Home Assistant tells browsers to keep `/local/` files for 31 days, so without the cache clear the tablet keeps showing the old version. (It keeps working either way, because deploys leave the old files in place.) You may need to sign in once more after a cache clear.

Changing only `public/config.json` (for example the photo, or `idleMinutes`) works the same way.

## 9. Troubleshooting

- **Blank page:** Home Assistant's address changed (Part 2), or `/config/www/kitchen/index.html` is missing (Part 3).
- **Everything says "Not connected":** check that Home Assistant is up and the `kitchen` sign-in is still valid. Reload the start URL.
- **Sign-in loops back to the sign-in page:** in Fully, **Web content settings → Enable third-party cookies** on, then reload.
- **Layout looks too big or too small:** **Advanced web settings → Use wide viewport** on and **Initial scale** blank (automatic). The hub expects a 1280 × 800 page.
- **Front Door says "Sign in again":** the lock's Google sign-in expired. Redo the Nest Yale sign-in (issue token + cookie) from the separate Firefox profile, as in Part 14 of [README-ha-setup.md](README-ha-setup.md#14-hacs-and-the-nest-x-yale-lock).
- **Photo frame never shows:** `background` must be set in `config.json`, and nothing should be touching the screen. It never covers the doorbell or cook mode.
