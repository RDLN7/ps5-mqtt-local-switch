# PS5 MQTT Local Control

Home Assistant add-on for discovering and controlling PlayStation 5 consoles
through MQTT. This fork adds local Remote Play pairing for wake and Rest Mode,
so the power switch does not require Sony OAuth, an NPSSO token, or a PSN login
inside Home Assistant.

The original **PS5 MQTT** project was created by
[Florentijn Cornet (FunkeyFlo)](https://github.com/FunkeyFlo) and
[Andrew Smith (andrew-codes)](https://github.com/andrew-codes). This fork keeps
the original MQTT discovery, state reporting, and optional PSN activity
features while adding the local control backend.

## Features

- MQTT discovery for Home Assistant
- Actual PS5 awake/standby state tracking
- Wake from Rest Mode over the local network
- Put an awake PS5 into Rest Mode through a local Chiaki session
- Pair from the add-on Web UI using Account ID + PS5 Link Device PIN
- Persistent local credentials stored under `/config/ps5-mqtt`
- Optional NPSSO accounts for game/activity metadata only
- `amd64` and `aarch64` add-on images

## Install

[![Open your Home Assistant instance and add this add-on repository.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FRDLN7%2Fps5-mqtt-local-switch)

1. Install and start the Home Assistant Mosquitto broker (or configure another
   MQTT broker).
2. Add this repository to **Settings → Apps → App store → Repositories**:
   `https://github.com/RDLN7/ps5-mqtt-local-switch`
3. Install **PS5 MQTT Local Control**.
4. Start the add-on and open its Web UI.
5. Select your PS5 and choose **Pair local control**.
6. On the PS5, open **Settings → System → Remote Play → Link Device**.
7. Enter that user's Base64 Account ID and the new 8-digit PIN in the Web UI.

The PIN is temporary. The add-on saves the resulting local registration key
and Remote Play key; it does not save the PIN.

## What does and does not need PSN

Wake, Rest Mode, discovery, and state reporting use only the local network
after pairing. `psn_accounts` is optional and is used only when you want PSN
presence/game activity metadata.

The PS5 pairing protocol still requires the Account ID belonging to the
console user being paired. This is not a Sony password, OAuth token, or NPSSO
token. Keep the generated registration credentials private.

See [the add-on manual](docs/DOCS.md) for configuration, troubleshooting, and
security details.

## Local-control implementation

The bundled `ps5-mqtt-local-rp` helper is built from the pinned
[CloudPad](https://github.com/Chazq2023/CloudPad-Android) Chiaki fork. It:

1. registers locally using Account ID + Link Device PIN;
2. sends Chiaki's local wake packet;
3. opens a minimal audio/video-disabled local session and calls
   `chiaki_session_goto_bed()` for Rest Mode.

The native helper and its Chiaki-derived code are distributed under
AGPL-3.0-only. See the source and repository licenses for details.
