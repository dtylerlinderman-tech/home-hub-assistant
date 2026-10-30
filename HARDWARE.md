# Kitchen Hub hardware setup

What to buy and how to put it together. You need a small always-on computer running Home Assistant, a wall-mounted Android tablet that shows the hub, and your home network tying them together. Your smart devices (doorbell, thermostats and so on) are optional: the hub shows only what you connect.

This guide covers the physical side. When it sends you to the step-by-step guides, those are:

- [ha/README-ha-setup.md](ha/README-ha-setup.md): installing Home Assistant and connecting each device.
- [ha/README-tablet.md](ha/README-tablet.md): putting the hub on the tablet.

They were written for one house (an old Lenovo Yoga laptop as the server, a TP-Link Deco mesh router), so swap in your own hardware where they name it.

**Time:** an afternoon for the server and network, an hour for the tablet, plus a bit for each device you connect.

---

## Contents

1. [How it fits together](#1-how-it-fits-together)
2. [Shopping list](#2-shopping-list)
3. [The Home Assistant server](#3-the-home-assistant-server)
4. [Your network](#4-your-network)
5. [The tablet](#5-the-tablet)
6. [Mounting and power](#6-mounting-and-power)
7. [Smart devices the hub supports](#7-smart-devices-the-hub-supports)
8. [Putting it together, in order](#8-putting-it-together-in-order)

---

## 1. How it fits together

```
 Smart devices ──(cloud or Wi-Fi)──┐
                                   ▼
 ┌──────────────────────┐   Ethernet   ┌────────┐   Wi-Fi   ┌──────────────────────────┐
 │ Home Assistant server │────────────▶│ Router │◀──────────│ Tablet (Fully Kiosk)      │
 │ • runs 24/7           │             └────────┘           │ shows the hub web page     │
 │ • serves the hub app  │                                  │ served by Home Assistant   │
 └──────────────────────┘                                   └──────────────────────────┘
```

- **Home Assistant** does all the work: it talks to your devices and serves the hub as a web page at `http://<server-ip>/local/kitchen/index.html`.
- **The tablet** just shows that page full screen in Fully Kiosk Browser. If the tablet breaks, any browser on the network can show the hub.
- Nothing is exposed to the internet. The hub only works at home unless you add remote access later (Part 18 of the setup guide).

## 2. Shopping list

Prices are rough US prices from late 2026.

**Required**

| Item | What to get | About |
|---|---|---|
| Home Assistant server | An old laptop or PC you already own, a used mini PC, or a **Home Assistant Green** (see Part 3) | $0–150 |
| Ethernet cable | From the server to your router | $5 |
| USB Ethernet adapter | Only if the server has no Ethernet port. Realtek RTL8153 or ASIX AX88179 chips work out of the box | $15 |
| Tablet | **Android, about 11", 1920 × 1200 screen**, e.g. Samsung Galaxy Tab A9+ or Lenovo Tab M11 (see Part 5) | $150–250 |
| Fully Kiosk Browser **Plus** license | One per tablet, bought inside the app | $9 |
| Tablet charger | **USB-C PD, 20 W or more.** Many tablets ship with a slow 10 W charger | $15 |
| Wall mount | See Part 6 | $20–40 |

**Optional**

| Item | Why |
|---|---|
| USB-C PD wall outlet (20 W+) or a recessed outlet | A clean, permanent power source behind the tablet |
| Right-angle USB-C cable, 3–6 ft | Keeps the plug flush against the wall |
| Google Device Access fee ($5, one-time) | Only for a Nest doorbell or Nest thermostat (Part 13 of the setup guide) |

## 3. The Home Assistant server

Anything that can run **Home Assistant OS** around the clock works. Pick one:

| Option | Good | Watch out |
|---|---|---|
| **Old laptop** (what we used) | Free, quiet, and the battery doubles as a backup power supply | Installing Home Assistant OS **wipes the laptop**. Turn on the maker's battery-saving charge limit **before** wiping (Lenovo Vantage "Conservation mode", Dell "Primarily AC", etc.), or the battery swells from sitting at 100% |
| **Used mini PC** (Intel N100 or similar) | Small, low power, fast | Needs a monitor and keyboard for the install |
| **Home Assistant Green** | Made for this: plug in and go, no install | Costs more than a used mini PC; slower |

Whichever you pick:

- **Wire it to the router with Ethernet.** Wi-Fi works, but a 24/7 hub is much more reliable wired.
- **Put it somewhere out of the way** with ventilation: a shelf near the router is ideal. A laptop can run with the lid closed once it's set up.
- **Install:** follow Parts 1–6 of [the setup guide](ha/README-ha-setup.md). Home Assistant Green owners skip straight to Part 3 there.

## 4. Your network

Two router settings matter. Every router has them; names vary.

1. **Reserve fixed addresses** ("DHCP reservation" or "Address reservation") for the **server** and the **tablet**. The tablet loads the hub from the server's address, and Home Assistant controls the tablet by its address. If either changes, things break. Do the server as soon as it's wired in, and the tablet once it's on Wi-Fi.
2. **A 2.4 GHz network for fussy appliances (optional).** Some smart appliances (LG ThinQ washers and dryers, many smart plugs) only join 2.4 GHz networks and fail on a combined 2.4/5 GHz network. Mesh routers often have an **IoT network** option for this; on TP-Link Deco it's under **More → IoT Network**. Use WPA2, not WPA3-only. Keep the server, tablet and TVs on your **main** network: Home Assistant finds TVs and controls the tablet over the local network.

## 5. The tablet

**What to look for:**

- **Android.** Fully Kiosk Browser is Android-only, so no iPads.
- **About 11", 1920 × 1200.** The hub is designed for a 1280 × 800 page, which is exactly what a 1920 × 1200 Android tablet shows. An 8" tablet works too (the hub scales itself down), but text and buttons get small at arm's length.
- **A front camera,** so Fully can wake the screen when someone walks up.
- **A battery charge limit** ("Protect battery" on Samsung). A tablet charging at 100% around the clock swells its battery within a year or two.

**Setup:** follow [the tablet guide](ha/README-tablet.md). It covers Android settings, Fully Kiosk settings, signing in, and connecting the tablet to Home Assistant so the doorbell wakes the screen and the screen sleeps overnight.

## 6. Mounting and power

The tablet stays plugged in permanently, so **plan the mount around power first**.

**Where:**

- Center of the screen about **55–60" (140–150 cm) off the floor**, easy to read standing and reachable for kids.
- Away from the stove and sink (heat and splashes), and not facing a bright window (glare).
- Within Wi-Fi range. Check the signal on the tablet at the spot before drilling.

**Power, from tidiest to simplest:**

1. **A USB-C PD wall outlet** (20 W+) right behind or below the tablet. Short cable, nothing visible. Needs an outlet swap (or an electrician).
2. **A recessed outlet** behind the mount, with the charger plugged into it. The charger hides behind the tablet.
3. **An existing outlet** below, with a right-angle USB-C cable run in a paintable cord cover.

**Mount:**

- **Screw-in wall mounts** are the sturdiest. Pick one made for your tablet model, or a universal one with adjustable clamps. Make sure it leaves the **USB-C port, front camera and volume buttons** clear.
- **Magnetic mounts** (a plate on the wall, a magnet on the tablet's case) let you pull the tablet off to use it in hand. Use screws, not adhesive, for the wall plate.
- Use **wall anchors** rated for at least 10 lb if you're not screwing into a stud.

## 7. Smart devices the hub supports

All optional. Anything you don't connect shows "Not connected" or stays hidden. Each one has a part in [the setup guide](ha/README-ha-setup.md).

| Hub feature | Works with | Setup guide part | Notes |
|---|---|---|---|
| Calendar, week view | Google Calendar or iCloud calendars | 8 | Free |
| Thermostats (Climate) | ecobee | 9 | Free |
| Meals and recipes | **Mealie**, runs on the Home Assistant server | 11 | Free, no hardware |
| School-run "leave by" | Waze travel time | 12 | Free, no hardware |
| Front door camera and doorbell takeover | Nest doorbell | 13 | $5 Google Device Access fee |
| Door lock with PIN pad | Nest x Yale lock | 14 | Community integration (HACS); its Google sign-in expires now and then |
| TV: now playing, play/pause | Android TV / Google TV (Chromecast) | 15 | Free |
| Vacuum | iRobot Roomba | 20 | Community integration (HACS) |
| Weather | Built in (met.no) | 3 | Free, no setup |
| Games card | Team Tracker (HACS) | — | Pick your teams in `config.json` |
| Flight card | Flightradar24 (HACS) + flight numbers in your calendar | — | Free, no account |
| Packages arriving today (Front Door card) | Mail and Packages (HACS) reading your shipping emails | — | Free; needs a Gmail app password. List each inbox in `config.json` `packages.sensorPrefixes` |
| Grocery list and "Send to …" email | Mealie shopping list + the SMTP integration | 11 | Free; needs a Gmail app password |

## 8. Putting it together, in order

1. **Server:** set it up and wire it to the router ([setup guide](ha/README-ha-setup.md) Parts 1–6).
2. **Network:** reserve the server's address (Part 4 above).
3. **Devices:** connect the ones you have (Part 7 above), then fill in `public/config.json` ([setup guide](ha/README-ha-setup.md) Part 17).
4. **Hub app:** deploy it to Home Assistant from a laptop ([tablet guide](ha/README-tablet.md) Part 3) and check it in a laptop browser first.
5. **Tablet:** set it up and install Fully Kiosk on a table, not the wall ([tablet guide](ha/README-tablet.md) Parts 4–7). Reserve its address.
6. **Mount it:** once everything works, power and mount it (Part 6 above).

**Check:** from across the kitchen you can read the clock and the next event; ringing the doorbell wakes the screen with the camera view; after 10 PM the screen sleeps and wakes when you walk up.
