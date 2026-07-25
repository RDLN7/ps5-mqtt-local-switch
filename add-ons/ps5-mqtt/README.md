# PS5 MQTT Local Control

PS5 MQTT Local Control is a Home Assistant add-on that discovers PlayStation
consoles and exposes them through MQTT. It can wake a paired PS5 from Rest Mode
and send an awake PS5 back to Rest Mode without requiring Sony OAuth, an NPSSO
token, or a PSN login inside Home Assistant.

This project is a fork of **PS5 MQTT**, originally created by
[Florentijn Cornet (FunkeyFlo)](https://github.com/FunkeyFlo) and
[Andrew Smith (andrew-codes)](https://github.com/andrew-codes). The fork keeps
the original MQTT discovery, console-state, and optional PSN activity features,
and adds a bundled local-control backend.

## What it does

- Discovers PS5 and supported PS4 consoles on the local network.
- Creates a Home Assistant MQTT power switch for each console.
- Pairs locally from the add-on Web UI using an Account ID and the PS5's
  temporary eight-digit **Link Device** PIN.
- Wakes a paired PS5 from Rest Mode over the local network.
- Opens a minimal, audio/video-disabled Remote Play session to request Rest
  Mode.
- Verifies that the PS5 is actually awake before reporting `AWAKE`.
- Publishes diagnostic sensors for last seen time, response latency, local
  credential health, and firmware version.
- Optionally uses PSN/NPSSO accounts for game and presence metadata.
- Stores pairing credentials persistently under `/config/ps5-mqtt`.
- Provides prebuilt `amd64` and `aarch64` Home Assistant add-on images.

This is **not** a HACS integration and it is **not** a game-streaming client.
Everything required for local power control is included in the add-on image.

## Install

[![Open your Home Assistant instance and add this add-on repository.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FRDLN7%2Fps5-mqtt-local-switch)

1. Install and start the Home Assistant Mosquitto broker, or prepare another
   MQTT broker.
2. Add this repository in **Settings → Apps → App store → Repositories**:
   `https://github.com/RDLN7/ps5-mqtt-local-switch`
3. Install **PS5 MQTT Local Control**.
4. Start the add-on and open its Web UI.
5. Select the PS5 and choose **Pair local control**.
6. On the PS5, open **Settings → System → Remote Play → Link Device**.
7. Enter the selected user's Base64 Account ID and the new eight-digit PIN in
   the add-on Web UI.

The PIN is temporary and is not stored. The add-on saves the resulting local
registration credentials. A new PIN can be generated for the same PS5 user
whenever pairing needs to be repeated.

## PSN account requirements

Local discovery, wake, Rest Mode, state reporting, and diagnostics do not need a
PSN login in Home Assistant. The Account ID used during pairing identifies a
PS5 user; it is not that user's Sony password, OAuth token, or NPSSO token.

The optional `psn_accounts` configuration is only required for PSN
presence/game metadata.

## Power consumption

The PS5 local discovery and Remote Play protocols do not expose actual watts or
energy consumption. Use a Home Assistant-compatible energy-monitoring smart
plug for accurate power and kWh sensors. Any estimate based only on console
state would be approximate and is therefore not published by this add-on.

## Documentation

Read the
[complete manual](https://github.com/RDLN7/ps5-mqtt-local-switch/blob/main/docs/DOCS.md)
for PS5 settings, pairing, configuration, entity behavior, upgrades,
troubleshooting, and security guidance.

## Local-control implementation

The bundled `ps5-mqtt-local-rp` helper uses local Remote Play protocol logic
from a pinned
[CloudPad](https://github.com/Chazq2023/CloudPad-Android) Chiaki fork. It:

1. registers locally using the Account ID and Link Device PIN;
2. sends Chiaki's local wake packet; and
3. opens a minimal session and calls `chiaki_session_goto_bed()` for Rest Mode.

The helper and its Chiaki-derived components are distributed under their
applicable open-source licences. See the repository licence files and
third-party source notices for details.
