# Home Assistant setup for Kitchen Hub

Step-by-step setup of Home Assistant on the old Lenovo Yoga, plus every integration Kitchen Hub uses.
Work through the parts in order. Each one ends with a **Check** so you know it worked before moving on.

Checked against the Home Assistant docs in October 2026 (Home Assistant OS 18.x, Home Assistant 2026.10).
If a screen looks different from what's described here, the docs linked in each part are the source of truth.

**Time:** about half a day in total. Parts 1–5 take about 1.5 hours. Nest (Part 13) is the longest single step.

**Port:** current installs serve Home Assistant on the standard web port, so the address is `http://homeassistant.local` with no `:8123`. It only falls back to 8123 if port 80 is already in use.

**Naming changes since older guides:**

- *Add-ons* are now called **Apps** (Settings → Apps → App Store), since 2026.2.
- The `http:` block in `configuration.yaml` moved to the UI (**Settings → System → Network → HTTP server**), since 2026.8.
- *Developer tools* is now **Tools**, found under **Settings** (States, Actions, YAML and other tabs are the same).

---

## Contents

1. [Before you wipe Windows](#1-before-you-wipe-windows)
2. [Install Home Assistant OS on the Yoga](#2-install-home-assistant-os-on-the-yoga)
3. [First-run setup](#3-first-run-setup)
4. [Housekeeping: fixed IP, advanced mode, backups](#4-housekeeping-fixed-ip-advanced-mode-backups)
5. [Create the `kitchen` user](#5-create-the-kitchen-user)
6. [File access and packages](#6-file-access-and-packages)
7. [Let your laptop's dev server connect](#7-let-your-laptops-dev-server-connect)
8. [Google Calendar](#8-google-calendar) (or [Apple iCloud calendars](#8b-apple-icloud-calendars-instead))
9. [ecobee thermostats](#9-ecobee-thermostats)
10. [To-do lists: kids' tasks and home reminders](#10-to-do-lists-kids-tasks-and-home-reminders)
11. [Mealie: recipes and meal plans](#11-mealie-recipes-and-meal-plans)
12. [Waze school-run drive time](#12-waze-school-run-drive-time)
13. [Nest doorbell](#13-nest-doorbell)
14. [HACS and the Nest x Yale lock](#14-hacs-and-the-nest-x-yale-lock)
15. [TVs: Android TV Remote and Google Cast](#15-tvs-android-tv-remote-and-google-cast)
16. [Your phone: Companion app](#16-your-phone-companion-app)
17. [Collect entity IDs into config.json](#17-collect-entity-ids-into-configjson)
18. [Optional: access from outside the house](#18-optional-access-from-outside-the-house)
19. [What changed from HANDOFF.md](#19-what-changed-from-handoffmd)
20. [iRobot Roomba (Roomba+)](#20-irobot-roomba-roomba)
21. [Kitchen Hub package: PIN unlock, relock, Waze schedule](#21-kitchen-hub-package-pin-unlock-relock-waze-schedule)

---

## 1. Before you wipe Windows

Do these while Windows is still on the Yoga. Some of them can't be done afterwards.

- [ ] **Turn on battery conservation mode.** Open **Lenovo Vantage** → Device → Power → **Conservation mode: On**. This caps the charge at about 55–60% and is stored in the laptop's firmware, so it stays on after Windows is gone. A laptop left on the charger 24/7 at 100% will swell its battery over time.
- [ ] **Copy off anything you want to keep.** Installing Home Assistant OS erases the whole internal drive.
- [ ] **Find the BIOS key.** On most Yogas it's **F2**, or the tiny **Novo** pinhole button next to the power jack (press it with a paperclip while the laptop is off).
- [ ] **Get a USB Ethernet adapter** and plug it into your router. Wired is much more reliable than Wi-Fi for a 24/7 hub. Adapters with Realtek RTL8153 or ASIX AX88179 chips work with Home Assistant OS out of the box.
- [ ] **Make an Ubuntu USB stick.** On any PC, download Ubuntu Desktop from <https://ubuntu.com/download/desktop> and write it to an 8 GB or larger USB stick with balenaEtcher (<https://etcher.balena.io>).

## 2. Install Home Assistant OS on the Yoga

Docs: <https://www.home-assistant.io/installation/generic-x86-64>

**BIOS settings**

1. Power on the Yoga and press **F2** (or use the Novo button → BIOS Setup).
2. Set **Boot Mode: UEFI**.
3. Set **Secure Boot: Disabled**.
4. If there's an option like **Power on with AC attach** or **Restore on AC power loss**, turn it on so the hub comes back by itself after a power cut.
5. Save and exit (usually **F10**).

**Write the image to the internal drive**

1. Plug in the Ubuntu USB stick and boot from it (the **F12** boot menu, or Novo → Boot Menu).
2. Choose **Try Ubuntu**. Do **not** choose Install.
3. Connect to Wi-Fi (or the Ethernet adapter).
4. In Ubuntu's Firefox, download the **Generic x86-64** image from the docs page above. The file is named like `haos_generic-x86-64-18.3.img.xz`.
5. Open the **Disks** app. In the left column, select the Yoga's **internal** drive. Check the size so you don't pick the USB stick.
6. Click the **⋮** menu (top right) → **Restore Disk Image…** → choose the downloaded file → **Start Restoring…** → **Restore**.
7. When it finishes, shut down, remove the USB stick, and plug in the Ethernet adapter.

**First boot**

1. Power on. If it says no bootable device, go into the BIOS boot options and add the EFI file `\EFI\BOOT\bootx64.efi` from the internal drive as a boot entry.
2. The screen shows a Home Assistant banner with an IP address. Home Assistant downloads its latest version the first time, which takes 5–20 minutes.
3. **Close the lid** and confirm the laptop keeps running: the IP address keeps answering in step 3 below. If closing the lid suspends it, leave it slightly open.

**If something goes wrong**

- *"target is busy"* in Disks: Ubuntu is running from the internal drive, not the USB stick. Reboot and choose **Try Ubuntu**.
- *Won't boot after writing*: some NVMe drives only support 4K sectors, which Home Assistant OS can't boot from. This is rare on Yogas; tell me the drive model if it happens.

## 3. First-run setup

1. On your laptop (or phone), open <http://homeassistant.local>. If that doesn't load, use the IP address shown on the Yoga's screen: `http://<ip>`.
2. Wait for "Preparing Home Assistant" to finish.
3. **Create your owner account.** This is **your** admin account, not the kitchen one. Use a strong password and save it in your password manager.
4. **Home location:** search for your address. This sets `zone.home`, which the weather and the school-run drive time both use.
5. **Time zone:** America/New_York. **Units:** US customary (°F).
6. **Analytics:** your choice.
7. **Discovered devices:** Home Assistant may already list ecobee, Google Cast and Android TV devices. You can skip them now; Parts 9 and 15 set them up properly.

**Check:** the Overview page loads, and **Settings → Devices & services** shows **Met.no**. Met.no provides the weather entity (`weather.forecast_home`), which Home Assistant creates for you during setup.

## 4. Housekeeping: fixed IP, advanced mode, backups

1. **Give the Yoga a fixed IP.** In your router's admin page, find the Yoga under DHCP clients (it's named `homeassistant`) and add a **DHCP reservation**. Write the IP here: `_______________`. If `homeassistant.local` ever fails to resolve on the tablet, that IP is the fallback.
2. **Advanced mode:** if your profile page (click your name, bottom left) has an **Advanced mode** switch, turn it on. Newer versions may not have it; nothing in this guide depends on it.
3. **Updates:** go to **Settings → Updates** and install everything offered. Restart when asked.
4. **Backups:** go to **Settings → System → Backups** → **Set up backups**. Choose automatic daily backups and keep 3.
   - **Save the backup encryption key in your password manager.** Without it, a backup can't be restored.
   - Set a backup location off the Yoga too, such as a network share or Google Drive (via its integration).

## 5. Create the `kitchen` user

The tablet and browsers log in as this user. It is not an admin, so it can't change Home Assistant's settings.

1. Go to **Settings → People → Add person**.
2. Name: **Kitchen**. Turn on **Allow person to login**.
3. Username: `kitchen`. Set a password and save it in your password manager.
4. **Can only log in from the local network:** on. This stops the account from working outside the house, even if a password leaks.
5. **Administrator:** off.
6. Click **Create**.

**Check:** open a private browser window, go to `http://homeassistant.local`, and log in as `kitchen`. You should see the Overview without a **Settings** menu. Log out.

## 6. File access and packages

Kitchen Hub's helpers, scripts and automations ship as one file, `ha/packages/kitchen_hub.yaml` (written in Phase 3). Home Assistant needs to be told to load files from a `packages` folder, and you need a way to copy the app's files onto the Yoga.

**Install the Samba share app** (the deploy script uses it to copy the built app into `/config/www/kitchen/`):

1. **Settings → Apps → App Store** → search **Samba share** → **Install**.
2. Open its **Configuration** tab. Set a **username** and **password** (not your Home Assistant login), and click **Save**.
3. Go to the **Info** tab → **Start**. Turn on **Start on boot**.
4. **Check:** on your Windows laptop, open File Explorer and type `\\homeassistant.local\config` in the address bar. Sign in with the Samba username and password. You should see `configuration.yaml`.

**Install an editor app** (to edit YAML in the browser):

1. **Settings → Apps → App Store** → **Studio Code Server** (or the simpler **File editor**) → **Install** → **Start**. Turn on **Show in sidebar**.

**Turn on packages:**

1. Using the editor or the Samba share, open `/config/configuration.yaml`.
2. If there is already a `homeassistant:` line, add the `packages:` line under it. Otherwise, add both lines at the bottom:

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```

3. Create the folder `/config/packages/` (empty for now).
4. Create the folder `/config/www/kitchen/`. Files in it are served at `http://homeassistant.local/local/kitchen/`.
5. Go to **Tools → YAML** → **Check configuration**. When it shows "Configuration will not prevent Home Assistant from starting", click **Restart**.

## 7. Let your laptop's dev server connect

While developing, the app runs on your laptop at `http://localhost:5173` and signs in to Home Assistant from there. A browser only allows that if Home Assistant lists the dev server's address as an allowed origin (CORS). The deployed app at `/local/kitchen/` doesn't need this.

1. Go to **Settings → System → Network** and scroll to **HTTP server**.
2. Under **CORS allowed origins**, add:
   - `http://localhost:5173` (the dev server)
   - `http://localhost:4173` (`npm run preview`)
3. Click **Save**. Home Assistant restarts its web server, then asks you to **confirm** the new settings. Confirm within 5 minutes, or it reverts.

**Check:** this one is mine to verify. Once Phase 2 is built, the dev app will redirect you to Home Assistant's login, and you'll come back signed in.

## 8. Google Calendar

Docs: <https://www.home-assistant.io/integrations/google/>

Nest (Part 13) needs a Google Cloud project too. **Use one Google Cloud project and one OAuth client for both**, so you set up Google's consent screen once. Do this part with the Google account that owns the family calendars.

**In Google Cloud** (<https://console.cloud.google.com>):

1. Top bar → project picker → **New project** → name it `kitchen-hub` → **Create**. Make sure it's selected afterwards.
2. **APIs & Services → Library**: enable **Google Calendar API**. While you're here, also enable **Smart Device Management API** and **Cloud Pub/Sub API** for Nest later.
3. **Google Auth Platform → Branding** → **Get started**:
   - App name: `Kitchen Hub`. Support email: your email.
   - Audience: **External**. Contact email: your email. Accept the policy.
   - Fill in **Application home page** `https://home-assistant.io`, **Privacy policy** `https://home-assistant.io/privacy`, **Terms of service** `https://home-assistant.io/tos`, and add `home-assistant.io` under **Authorized domains**. Without these, **Publish app** in the next step stays grayed out.
   - Leave the **logo** empty. Uploading one triggers Google's app-verification process.
4. **Google Auth Platform → Audience** → **Publish app**. If you leave it in "Testing", Google logs Home Assistant out every 7 days.
5. **Google Auth Platform → Clients** → **Create client**:
   - Type: **Web application**. Name: `Home Assistant`.
   - **Authorized redirect URIs** → add `https://my.home-assistant.io/redirect/oauth`.
   - Click **Create**. **Copy the Client ID and Client Secret into your password manager now.** The secret can't be shown again.

**In Home Assistant:**

1. **Settings → Devices & services → Add integration → Google Calendar.**
2. Paste the Client ID and Client Secret when asked for application credentials.
3. Sign in with the Google account. When you see "Google hasn't verified this app", click **Advanced → Go to Kitchen Hub (unsafe)**. This is your own app, so it's safe.
4. Click **Link account**, then confirm the **Success** message.
5. Open the integration and look at its entities. You get one `calendar.*` entity per Google calendar. Disable the ones the kitchen shouldn't show.

**Tell me:** which calendars belong to which person (Alex, Sam, Kids, Family). Kitchen Hub colors events by person.

**Check:** **Tools → Actions** → `calendar.get_events`. Pick your family calendar, set a duration of 7 days, and turn on **Return response**. Click **Perform action**. This week's events should appear.

### 8b. Apple (iCloud) calendars instead

If the family calendars live in Apple Calendar, use Home Assistant's built-in **CalDAV** integration instead of Google Calendar. You don't need Google Cloud for this. Nest (Part 13) still needs a Google Cloud project, though.

Docs: <https://www.home-assistant.io/integrations/caldav/>

1. **App-specific password:** at <https://account.apple.com>, go to **Sign-In and Security → App-Specific Passwords → +**. Name it `Home Assistant` and copy the password (`abcd-efgh-ijkl-mnop`). The option only appears if two-factor authentication is on.
2. **Settings → Devices & services → Add integration → CalDAV.**
   - **URL:** `https://caldav.icloud.com`
   - **Username:** your Apple ID email.
   - **Password:** the app-specific password.
3. Open the integration's entities. There's one `calendar.*` entity per iCloud calendar. Disable the ones the kitchen shouldn't show.
4. **Sam's calendars**, if they're on her own Apple ID: either she shares them with you in the iPhone Calendar app (Calendars → ⓘ → Add Person) and you check whether they appear under your account, or you add a second CalDAV entry with her Apple ID and her own app-specific password.

Home Assistant checks iCloud about every 15 minutes, so new events can take that long to appear.

**Tell me:** the calendar entity IDs and whose each one is.

**Check:** same as above. Run **Tools → Actions** → `calendar.get_events` on one of the new calendars.

## 9. ecobee thermostats

Docs: <https://www.home-assistant.io/integrations/ecobee/>

No developer API key is needed any more (since Home Assistant 2026.3).

1. **Settings → Devices & services → Add integration → ecobee**. Or click **Configure** if it's already under **Discovered**.
2. Leave **API key** blank. Enter your ecobee.com **email** and **password**.
3. If your ecobee account uses two-step verification, enter the 6-digit code from your **authenticator app or SMS**. Email codes and push approvals are **not** supported. If yours uses those, switch it to an authenticator app first in the ecobee app.
4. Rename the entities so they match the config: open each thermostat → ⚙ → set the entity IDs to `climate.downstairs` and `climate.upstairs` (or tell me what you chose).

**Tell me:**

- The real zone names.
- The **preset_modes** list. In **Tools → States**, click `climate.downstairs` and copy the `preset_modes` attribute. Kitchen Hub's Home/Away/Sleep buttons must use those exact names.
- The **fan_modes** list from the same screen.

**Check:** on the Overview, change one thermostat's set point by 1°. The ecobee shows the change within a few seconds.

## 10. To-do lists: kids' tasks and home reminders

Docs: <https://www.home-assistant.io/integrations/local_todo/>

Create three lists. The names below produce the entity IDs Kitchen Hub expects:

| Name you type | Entity ID it creates |
|---|---|
| `Max tasks` | `todo.max_tasks` |
| `Lily tasks` | `todo.lily_tasks` |
| `Home reminders` | `todo.home_reminders` |

For each list: **Settings → Devices & services → Add integration → Local To-do** → type the name → **Submit**.

**Add the kids' tasks.** Open **To-do lists** in the sidebar → choose the list → add an item. Then tap the item to open it, and put its section in **Description**:

```
section: morning
```

The sections are `morning`, `after_school` and `evening`. For a task that only happens on certain days, add a second line:

```
section: after_school
days: tue,thu
```

The day names are `mon tue wed thu fri sat sun`. The 4:00 AM reset automation comes with the Phase 3 package.

**Tell me:** the real task lists for Max and Lily, if you'd rather I type them in.

**Check:** **Tools → Actions** → `todo.get_items` → target `todo.max_tasks`, **Return response** on → **Perform action**. Your items and their descriptions are listed.

## 11. Mealie: recipes and meal plans

Docs: <https://www.home-assistant.io/integrations/mealie/>. The Home Assistant integration needs **Mealie 3.2.0 or newer**.

**Install Mealie as an app** (community app by alexbelgium):

1. **Settings → Apps → App Store** → **⋮** (top right) → **Repositories** → add `https://github.com/alexbelgium/hassio-addons` → **Add** → **Close**.
2. Search **Mealie** → **Install** → **Start**. Turn on **Start on boot** and **Show in sidebar**.
3. On the app's **Info** tab, check that the version is **3.2.0 or newer**.
4. Note the port on the **Configuration → Network** section. It's usually **9090**.
5. Open the Mealie web UI and log in with the default `changeme@example.com` / `MyPassword`. **Change both right away**: profile → edit email and password.

**Set Mealie up:**

1. In Mealie, open profile → **API tokens** (`/user/profile/api-tokens`) → create a token named `home-assistant` → copy it.
2. Add your recipes. In Mealie, **Create → Import from URL** works with most recipe sites.
3. For each recipe:
   - Fill in **Total time**. The meal rules use it ("Quick weeknights: 35 min or less").
   - Add **tags**: `Weeknight`, `Kids`, `Grill`, `Slow cooker` (at least one each, or the recipe won't be in the suggestion pool).
4. Check that Mealie has a **shopping list**. Create one called `Groceries` if not.

**Connect it to Home Assistant:**

1. If **Settings → Devices & services** shows Mealie under **Discovered**, click its **⋮** menu and choose **Ignore**. That auto-discovered form only asks for a token, then fails because it guesses the wrong address.
2. Click **+ Add integration** and choose **Mealie**. This form has a URL field.
3. **URL:** `http://db21ed7f-mealie:9001`. That's the app's address inside Home Assistant, and it doesn't change if the Yoga's IP does. `http://<yoga-ip>:9090` also works from the network, but it breaks when the IP changes.
4. **API token:** paste it. Leave **Verify SSL** on.
5. Afterwards you'll have:
   - `calendar.mealie_dinner` (and one calendar for each other meal type);
   - `sensor.mealie_recipes` and similar count sensors;
   - one `todo.mealie_*` per shopping list, once a list exists. Create a `Groceries` list in Mealie for the grocery button.
6. In the app's **Configuration** tab, set `ALLOW_SIGNUP` to `false` so nobody on the Wi-Fi can create accounts.

> The **Home Assistant Community Apps** version of Mealie only works through the sidebar and opens no network port, so the integration can't reach it. Use the alexbelgium version.


**Check:** **Tools → Actions** → `mealie.get_recipes` → pick your Mealie entry → **Return response** on → **Perform action**. Your recipes are listed.

## 12. Waze school-run drive time

Docs: <https://www.home-assistant.io/integrations/waze_travel_time/>

1. **Settings → Devices & services → Add integration → Waze Travel Time.**
2. Name: `School drive`. Home Assistant adds a `waze_` prefix, so this creates `sensor.waze_school_drive`.
3. **Origin:** `zone.home`.
4. **Destination:** `2400 Old Alabama Rd, Roswell, GA 30076`.
5. **Region:** `US`.
6. **Leave automatic polling on for now.** Later, the Phase 3 package refreshes the sensor every 5 minutes, but only during the drop-off and pick-up windows. Once that package is installed, turn polling off (steps below). Until then, polling is what keeps the sensor updating.
   1. Open the integration → **⋮** → **System options**.
   2. Turn off **Enable polling for changes**.

**Tell me:** the real drop-off and pick-up times, the leave buffer (currently 5 minutes), and the school days (currently Tue and Thu).

**Check:** **Tools → Actions** → `homeassistant.update_entity` → target `sensor.waze_school_drive` → **Perform action**. Then look at the sensor's state in **Tools → States**. It shows the drive time in minutes.

## 13. Nest doorbell

Docs: <https://www.home-assistant.io/integrations/nest/>

This is the longest part. It costs **US$5 (one-time, non-refundable)**. The Google account must be a regular Gmail account, not a Google Workspace account. Use the account that owns the doorbell in the Google Home app.

**Device Access** (<https://console.nest.google.com/device-access>):

1. Accept the terms and pay the $5.
2. **Create project** → name `Kitchen Hub`.
3. **OAuth client ID:** paste the **Client ID** from Part 8, so Nest and Calendar share it.
4. **Enable events:** leave this **unchecked** for now.
5. Click **Create project**. Copy the **Device Access Project ID** (a UUID).

**Pub/Sub topic** (Google Cloud console, same `kitchen-hub` project):

1. Search **Pub/Sub** → **Topics** → **Create topic** → topic ID `home-assistant-nest`. Uncheck "Add a default subscription" → **Create**.
2. Open the topic → **Permissions** tab (on the topic itself, not the IAM page) → **Add principal**:
   - Principal: `sdm-publisher@googlegroups.com`
   - Role: **Pub/Sub Publisher**
   - Click **Save**.
3. Back in the Device Access console, open your project → **Pub/Sub topic** → **Enable events with PubSub topic**. Enter the full name `projects/<your-cloud-project-id>/topics/home-assistant-nest` → **Add & Validate**.

**In Home Assistant:**

1. **Settings → Devices & services → Add integration → Google Nest.**
2. When asked for application credentials, reuse the Client ID and Secret from Part 8 (pick the existing credential if it's offered).
3. Enter the **Google Cloud project ID** and the **Device Access project ID**.
4. Sign in with the same Google account.
   - On the permissions screen, allow the **doorbell**. You can untick devices Kitchen Hub doesn't need.
   - At "Google hasn't verified this app", click **Advanced → Go to … (unsafe)**.
5. Choose the Pub/Sub topic. Let Home Assistant **create the subscription** for you.

You should get:

- a camera entity (e.g. `camera.front_door`);
- an **event** entity for rings, of type `doorbell`, whose events are `doorbell_chime`;
- an event entity for motion.

**Tell me:** your doorbell model (battery or wired, 1st or 2nd gen). Battery and 2nd-gen wired doorbells stream over WebRTC and may not provide still snapshots, which changes how the Home screen's front-door card gets its picture.

**Check:**

- Ring the doorbell. Within a few seconds, the ring event entity in **Tools → States** updates its time.
- Open the camera entity and the live view plays. It runs 1–3 seconds behind, which is normal for Nest.

## 14. HACS and the Nest x Yale lock

HACS installs community integrations. The Nest x Yale lock integration is **unofficial**: it copies a Google sign-in from your browser, and an update from Google can break it. The lock's own keypad and auto-lock keep working either way.

**Install HACS:**

1. **Settings → Apps → App Store** → **⋮ → Repositories** → add `https://github.com/hacs/addons` → close.
2. Install the **Get HACS** app → **Start** → open the **Log** tab and wait for "HACS installed".
3. **Settings → System → ⋮ → Restart Home Assistant.**
4. **Settings → Devices & services → Add integration → HACS.** Tick the acknowledgements, then sign in to GitHub with the device code shown. You need a free GitHub account.
5. Check that **HACS** appears in the sidebar.

**Install the lock integration:**

1. **HACS → ⋮ → Custom repositories** → add `https://github.com/krozgrov/ha-nest-yale-integration`, category **Integration**.
2. Search **Nest Yale Lock** → **Download**.
3. Restart Home Assistant.

**Get the two sign-in values**, in a Firefox profile used for nothing else:

> These two values work like a password to your Google account. Don't paste them into chats, emails or the repo. Paste them only into Home Assistant.

> **Why a separate profile:** values copied from Chrome Incognito died about 4 hours later (October 2026). Google rotates the session whenever the browser it came from touches Google again, or while a Nest tab stays open. Values from a browser profile that's never opened again last weeks or longer ([integration issue #36](https://github.com/krozgrov/ha-nest-yale-integration/issues/36)).

1. In Firefox, go to `about:profiles` → **Create a New Profile** (for example `nest-only`) → **Launch profile in new browser**. In its **Settings → Privacy & Security**, choose **Standard** so third-party cookies are allowed.
2. Open DevTools (**F12**) → **Network** tab. Tick **Persist Logs**. In the filter box, type `issueToken`.
3. Go to `https://home.nest.com` and **Sign in with Google**.
4. Right-click the request that starts with `iframerpc?action=issueToken` → **Copy Value → Copy URL**. This is the **issue token URL**.
5. Change the filter to `oauth2/iframe`. Click the **last** plain `iframe` request (not `checkOrigin`). Under **Request Headers**, turn on **Raw** and copy everything after `Cookie:`. It's long, with names like `SID=`, `__Secure-3PSID=` and `__Host-3PLSID=`. This is the **cookies** value.
6. **Close the whole window. Do not click Sign out**, and never open that profile again. Check that your usual profile is still the default in `about:profiles`.

If the hub's Front Door card later says **"Sign in again"**, repeat these steps (the same profile is fine for that one visit), then use **Reconfigure** on the Nest Yale integration.

**Add the integration:**

1. **Settings → Devices & services → Add integration → Google Nest x Yale Lock.**
2. Paste the issue token URL and the cookies → **Submit**.

You should get:

- `lock.front_door` (rename it to this if it's different);
- a battery sensor;
- a **Last action** sensor (Keypad, Physical or Remote);
- an **Auto-lock** switch and duration.

**Check:** lock and unlock from **Tools → States** → the lock entity's more-info panel. The lock responds within a few seconds.

**If it stops working later:** repeat the sign-in steps above to get fresh values, then open the integration → **Reconfigure**.

## 15. TVs: Android TV Remote and Google Cast

Docs: <https://www.home-assistant.io/integrations/androidtv_remote/> and <https://www.home-assistant.io/integrations/cast/>

Each Chromecast with Google TV gets **two** integrations:

- **Android TV Remote:** power, volume, buttons, launching apps and channels.
- **Google Cast:** what's playing (titles and artwork).

**Android TV Remote** (do this once per TV, with the TV on):

1. **Settings → Devices & services.** It's usually under **Discovered** → **Configure**. Otherwise, **Add integration → Android TV Remote** and enter the Chromecast's IP.
2. A pairing code appears on the TV. Type it into Home Assistant.

**Google Cast:** usually discovered automatically. **Add** each Chromecast.

**Rename the entities** to match the config (or tell me what you used):

| TV | Android TV Remote `remote` | Android TV Remote `media_player` | Google Cast `media_player` |
|---|---|---|---|
| Living room | `remote.living_room_tv` | `media_player.living_room_tv` | `media_player.living_room_tv_cast` |
| Bedroom | `remote.bedroom_tv` | `media_player.bedroom_tv` | `media_player.bedroom_tv_cast` |

**Tell me:**

- Your live-TV service. YouTube TV is assumed, but not confirmed.
- Your favorite channels, in the order you want them shown.

**Check:** **Tools → Actions** → `remote.send_command` → target `remote.living_room_tv`, command `CHANNEL_UP` → **Perform action**, while the live-TV app is open. If the channel changes, the Ch ▲ button will work.

## 16. Your phone: Companion app

1. Install **Home Assistant** from the App Store or Google Play.
2. Sign in as **yourself** (not `kitchen`). On the home network, it finds `homeassistant.local` automatically.
3. Allow notifications.
4. Back in Home Assistant, **Tools → Actions** → type `notify.mobile_app` and note your phone's action name (e.g. `notify.mobile_app_alexs_iphone`).

**Check:** perform that notify action with message `Hello from Kitchen Hub`. Your phone buzzes.

## 17. Collect entity IDs into config.json

The app reads every household-specific setting from `config.json`. Never guess entity IDs: check them in **Tools → States** (type in the filter box).

1. On your laptop, copy `public/config.example.json` to `public/config.json`. That file is git-ignored, so it never gets committed.
2. Fill in each value from the table below.

| config.json key | Where to find it |
|---|---|
| `haUrl` | `http://homeassistant.local` (or the fixed IP from Part 4) |
| `weather` | `weather.forecast_home` (from Met.no) |
| `calendars[].entity` and `.person` | Part 8 |
| `door.camera`, `door.doorbellEvent` | Part 13 (camera entity and the `event.*` ring entity) |
| `door.lock` | Part 14 |
| `climate[].entity` | Part 9 |
| `climatePresets` | the `preset_modes` attribute from Part 9 |
| `schoolRun.travelSensor` | `sensor.waze_school_drive` (Part 12) |
| `tvs[]` | Part 15 |
| `kids[].todo`, `homeReminders` | Part 10 |
| `mealie.configEntryId` | Part 11 |
| `notifyTarget` | Part 16 |
| `vacuum.*` | Part 20 |

You can skip anything you haven't set up yet. Those cards will show "Not connected" until you add them.

## 18. Optional: access from outside the house

Use the free **Tailscale** app. Don't open Home Assistant's port (80, or 8123 on some installs) on your router.

1. **Settings → Apps → App Store → Tailscale** → **Install** → **Start** → open the web UI and sign in to Tailscale.
2. Install Tailscale on your phone and sign in to the same account.
3. In the phone's Home Assistant app, set the **external URL** to the Yoga's Tailscale address (`http://100.x.y.z`).

The `kitchen` user is set to local network only, so it won't work over Tailscale, which is intended. Your own account will.

## 19. What changed from HANDOFF.md

While writing this guide I checked the handoff's **VERIFY** items against the current docs:

| Item | What I found |
|---|---|
| Recipe access through Home Assistant (§13 open item) | **Resolved.** The Mealie integration now has `mealie.get_recipes` (search) and `mealie.get_recipe` (full recipe), plus `import_recipe`, `get_mealplan`, `set_mealplan` and `update_mealplan`. Everything stays on the Home Assistant connection, with no Mealie REST fallback or CORS change needed. It requires Mealie 3.2.0+. |
| ecobee sign-in | Confirmed: username and password, no developer key, since 2026.3. Two-step verification works only with authenticator or SMS codes. |
| ecobee preset names | The docs don't list them. You'll read them off the real thermostat in Part 9. |
| TV channel keys | The command names are `CHANNEL_UP` / `CHANNEL_DOWN`, **not** `KEYCODE_CHANNEL_UP` as written in the handoff. Android TV Remote reports the app name only (no title or play state), so Google Cast stays necessary for Now Playing, as planned. Launching by app ID often fails; deep links are more reliable. |
| CORS for laptop development | Now set in the UI (**Settings → System → Network → HTTP server**) since 2026.8, not in `configuration.yaml`. |
| Nest doorbell events | Rings arrive as `event.<name>_chime` (event type `ring`); its state is the time of the last ring. Motion arrives as `event.<name>_motion`. |
| Nest snapshots | **Confirmed (2026-10-23):** the Nest Doorbell (Battery) gives no snapshots; its picture is a placeholder. Live view is WebRTC only, through `camera/webrtc/get_client_config`, `camera/webrtc/offer` (events: `session`, `answer`, `candidate`, `error`) and `camera/webrtc/candidate`. The Home card shows last ring and last motion times instead of a photo. |
| Nest two-way talk | Not mentioned in the docs; still treated as unsupported. |
| Nest x Yale lock | Has a **Last action** sensor (Keypad / Physical / Remote), so "Keypad · 5:48 PM" on the Home screen is possible. Also has auto-lock controls. Latest release (2026.10.07) fixes a state-refresh bug on Home Assistant 2026.10, so update it if HACS offers it. |
| Add-ons | Now called **Apps** (2026.2). |

Still to come in Phase 3: the `kitchen_hub.yaml` package (door PIN helper and script, lockout counter, relock automation, 4 AM task reset, Waze refresh schedule, meal-rule toggles) and the step to set the door PIN.

## 20. iRobot Roomba (Roomba+)

Kitchen Hub uses **Roomba+**, a community integration from HACS, instead of Home Assistant's built-in Roomba integration. The built-in one can start, stop and dock, but has no room cleaning, no run history and no map. Roomba+ has all three for i-series and s-series robots.

Docs: <https://github.com/johnnyh1975/ha_roomba_plus> (README and `docs/FEATURES.md`).

> Background: iRobot went through bankruptcy and is now owned by Picea (since January 2026). The iRobot app and cloud still work. Roomba+ controls the robot **locally**, so start, stop, dock and the live map keep working even if iRobot's cloud goes away. Room names and run history use the cloud.

**Before you start:**

- You need HACS (Part 14).
- If Home Assistant already found the Roomba and you added the **built-in Roomba** integration, delete it first: **Settings → Devices & services → Roomba → ⋮ → Delete**. Both integrations use the robot's single local connection and can't run together.
- Close the iRobot app on every phone while you pair.

**Install:**

1. **HACS** → search **Roomba+** → **Download**. It's in HACS's default list, so you don't need to add a custom repository.
2. Restart Home Assistant.

**Pair the robot:**

1. **Settings → Devices & services → Add integration → Roomba+.** The robot is usually found automatically. Otherwise, enter its IP (from your router's client list).
2. When asked for the password, put the robot on its dock and **hold HOME for about 2 seconds** until it plays a tone. Then submit within 30 seconds. This reads the robot's local password; it's not your iRobot account password.
3. **iRobot cloud login:** enter your iRobot app email and password when asked, or later under **Configure → iRobot cloud credentials**. This is what provides **room names**, **per-room last-cleaned times** and **run history** for the Kitchen Hub screen. Without it, you get start/stop and the live map only.
4. Name the device **Roomba**. Its entities are then named `vacuum.roomba`, `sensor.roomba_…` and so on, matching the example config.

**Rooms:** room names come from the Smart Map in the iRobot app. Rename rooms there (iRobot app → Smart Maps → edit) so the kitchen screen shows names you recognize. Roomba+ picks up the change within about a day, or right after the next cleaning run.

**Check:**

- **Tools → Actions** → `roomba_plus.smart_start` → target `vacuum.roomba`, **rooms**: `Kitchen` (use a real room name) → **Perform action**. The robot cleans only that room.
- **Tools → States** → `sensor.roomba_room_cleaning_history` lists each room with its last-cleaned time.
- `image.roomba_cleaning_map` shows the most recent run's map.

**Tell me:**

- The robot model (i3/i4/i7/i8/s9).
- The entity IDs Roomba+ created. In **Tools → States**, filter by `roomba` and send me the list. The names change if the device isn't called Roomba.

## 21. Kitchen Hub package: PIN unlock, relock, Waze schedule

The file `ha/packages/kitchen_hub.yaml` in this repo adds everything the kitchen screen needs from Home Assistant itself:

- **PIN unlock** (`script.kitchen_unlock_front_door`). Home Assistant checks the PIN; the browser never sees it.
- **Lockout:** 3 wrong PINs within 5 minutes lock the pad for 5 minutes.
- **Relock:** the door relocks 30 seconds after a kitchen unlock. The lock's own auto-lock stays on as a backstop.
- **School-run refresh:** the Waze drive time updates every 5 minutes, only on Tue/Thu around drop-off and pick-up.
- **Meal rules** shared between screens (four `input_boolean` toggles).
- **Tablet automations** for Fully Kiosk: the doorbell wakes the screen, and night mode. These stay off until the tablet phase.

**The PIN lives in `secrets.yaml`, not in a helper.** Helper values are visible to every logged-in account, including the kitchen tablet's. Secrets aren't.

**You need a way to edit files on the Yoga.** Install **File editor** or **Studio Code Server** (Settings → Apps → App Store). If the install fails the way Samba did, see the DNS fix in Part 6.

1. **Turn on packages**, if you haven't already: add to `/config/configuration.yaml`:
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
2. **Add the package:** create the folder `/config/packages/` and, in it, a file named `kitchen_hub.yaml`. Paste in this repo's `ha/packages/kitchen_hub.yaml`.
3. **Set the door PIN:** open `/config/secrets.yaml` (create it if it doesn't exist) and add a line with your PIN in quotes:
   ```yaml
   kitchen_door_pin: "1234"
   ```
   The quotes keep a leading zero. Don't use the PIN anywhere else.
4. **Settings → Tools → YAML → Check configuration.** When it's valid, **Restart**.
5. **Waze:** open the Waze integration → **⋮ → System options** → turn off **Enable polling for changes**. The package now refreshes it on schedule.

**Check:**

- `script.kitchen_unlock_front_door`, `timer.kitchen_door_relock`, `timer.kitchen_door_lockout` and `input_boolean.kitchen_meal_rule_quick` appear in **Tools → States**.
- On the kitchen screen's **Door** page, **Hold to unlock** unlocks the door after a 1-second press (a quick tap does nothing) and starts a 30-second relock countdown. Stand by the door the first time.
- **Want a PIN instead?** In `config.json`, set `door.pin` to `true` and `door.unlockScript` to `script.kitchen_unlock_front_door`. The PIN pad appears: a wrong PIN says "Wrong PIN, try again", and three wrong PINs lock the pad for 5 minutes.

**To change the PIN later** (PIN mode only): edit `secrets.yaml`, then **Tools → YAML → Scripts → Reload** (or restart).
