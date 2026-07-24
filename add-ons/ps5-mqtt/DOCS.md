# PS5 MQTT Local Control manual

This is a Home Assistant add-on based on the original PS5 MQTT project. It is
not a game-streaming application. It retains the original MQTT device
discovery and state logic, and replaces the power-switch credential path with
local Remote Play pairing.

Original authors: **Florentijn Cornet (FunkeyFlo)** and
**Andrew Smith (andrew-codes)**.

## Requirements

- Home Assistant OS or Supervised with Apps/add-ons support
- An MQTT broker
- PS5 and Home Assistant on the same routed local network
- Remote Play enabled on the PS5
- The Base64 Account ID for the PS5 user being paired
- Physical access to generate a temporary Link Device PIN

No separate executable, Android app, container, HACS integration, Sony OAuth
flow, NPSSO token, or PSN login in Home Assistant is required for power
control.

## Installation

1. Add `https://github.com/RDLN7/ps5-mqtt-local-switch` as an App store
   repository.
2. Install **PS5 MQTT Local Control**.
3. Leave `mqtt: {}` to use Home Assistant's MQTT service discovery, or enter a
   broker host, port, user, and password.
4. Start the add-on.
5. Open the add-on Web UI.

The add-on publishes Home Assistant MQTT discovery entities automatically.

## Pairing a PS5

1. Sign into the PS5 user you want Remote Play to use and leave that user in
   the foreground.
2. On the PS5, open **Settings → System → Remote Play** and ensure Remote Play
   is enabled.
3. Open **Link Device** to generate a fresh 8-digit PIN.
4. In the add-on Web UI, refresh devices and select **Pair local control** on
   that PS5.
5. Enter the selected user's Base64 Account ID and the fresh PIN.
6. Submit before the PIN expires.

Pairing produces a registration key and a 16-byte Remote Play key. They are
stored with mode `0600` in:

`/config/ps5-mqtt/local-remote-play.json`

Do not share or publish this file. Delete only the entry for a console if you
intend to pair it again.

## Power switch behavior

- **On**: sends a local Chiaki wake packet using the saved registration key.
- **Off**: opens a minimal local Remote Play session with audio and video
  disabled, requests Rest Mode, and closes the session.
- **State**: continues to use the original PS5 MQTT discovery/check path. The
  entity is not optimistic.

If the PS5 user profile has a login passcode, set `login_passcode` in the
add-on configuration. This is different from the temporary 8-digit Link
Device PIN.

## Optional PSN activity

`psn_accounts` is optional. Configure it only if you want PSN presence and
game/activity metadata. Local wake, Rest Mode, MQTT discovery, and console
state do not depend on it.

## Troubleshooting

### The PS5 is not discovered

- Confirm Home Assistant can route to the PS5.
- Keep `host_network: true` (already set by the add-on).
- If broadcast discovery crosses subnets, configure
  `device_discovery_broadcast_address`.

### Pairing fails

- Generate a new PIN and submit it before it expires.
- Ensure the Account ID belongs to the foreground PS5 user.
- Confirm Remote Play is enabled.
- Do not use the PSN online name in the Account ID field.

### Wake works but Rest Mode fails

- Pair again so the credential file contains both `regist_key` and `rp_key`.
- Ensure no other Remote Play client is using the console.
- Set `login_passcode` if the selected console profile requires one.
- Review the add-on log for the Chiaki quit reason.

### Existing installation still opens Sony OAuth

That is the original 1.6.x Web UI. Update to this fork's 1.7.1 or later image
and hard-refresh the add-on Web UI.

## Security

Local pairing does not bypass the console's Remote Play authorization. Anyone
who obtains the saved registration credentials and can reach the PS5 may be
able to wake or connect to it. Protect Home Assistant backups and the
`/config/ps5-mqtt` directory.
