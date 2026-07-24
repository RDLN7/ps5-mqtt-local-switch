# PS5 Local Remote Play for Home Assistant

This fork adds a HACS integration that wakes a PS5 locally from Rest Mode. It
does not use Sony OAuth, an NPSSO token, or a PSN sign-in in Home Assistant.

## What it uses

The setup is based on the same local Remote Play protocol used by
ActRemoteLink and Chiaki/CloudPad:

```text
Base64 account ID + temporary PS5 pairing PIN
  -> local Remote Play registration
  -> persistent registration key
  -> local UDP wake packet to the PS5
```

The generated registration key is sensitive. Treat it like a device password;
do not post it in logs, issues, or screenshots.

## Prerequisites

- PS5 on the same network as Home Assistant.
- PS5 in Rest Mode, with network wake and Remote Play enabled.
- A local account prepared with ActRemoteLink. Keep that user active while
  pairing.
- The Base64 Account ID and fresh eight-digit PIN produced by ActRemoteLink.
- HACS installed in Home Assistant.

## Create the local registration key

The source helper is in `native/local-remote-play`. It uses the CloudPad/Chiaki
local registration code and performs no PSN OAuth login.

```bash
cmake -S native/local-remote-play -B build/local-remote-play
cmake --build build/local-remote-play
./build/local-remote-play/ps5-mqtt-local-rp register \
  PS5_IP BASE64_ACCOUNT_ID EIGHT_DIGIT_PIN
```

The command prints a JSON object containing `regist_key`. Generate a fresh PIN
immediately before running it; PINs expire quickly.

## Install with HACS

1. In HACS, open **Integrations** and choose the custom repository option.
2. Add `https://github.com/fishredleung/ps5-mqtt` with category
   **Integration**.
3. Install **PS5 MQTT Local Remote Play** and restart Home Assistant.
4. Go to **Settings → Devices & services → Add integration**.
5. Select **PS5 Local Remote Play** and enter the PS5 IP address plus the
   generated registration key.

Home Assistant creates a `Power` switch. Turning it on sends the local
Chiaki-compatible wake packet to UDP port `9302`.

## Limits

- The switch wakes a PS5 from Rest Mode; it cannot power on a fully shut-down
  console.
- It is intentionally optimistic: the Remote Play discovery protocol does not
  provide a reliable acknowledgement or remote power-off command.
- Registration needs a PS5 pairing PIN, but it does not need Sony OAuth.
- The native helper includes CloudPad/Chiaki-derived code under AGPL-3.0-only;
  any distributed binary containing that helper must comply with that licence.
