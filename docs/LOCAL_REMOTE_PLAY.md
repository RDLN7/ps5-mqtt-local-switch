# Local Remote Play backend

`native/local-remote-play` builds `ps5-mqtt-local-rp` from a pinned CloudPad
Chiaki revision. The helper is packaged into both the Home Assistant add-on and
standalone container; users do not install it separately.

Commands:

```text
ps5-mqtt-local-rp register <host> <base64-account-id> <8-digit-pin>
ps5-mqtt-local-rp wake <host> <registration-key>
ps5-mqtt-local-rp standby <host> <registration-key> <rp-key-hex> [login-passcode]
```

Registration returns JSON containing `regist_key`, `rp_key`, `rp_key_type`, and
the server MAC. The Node service validates and stores that output without
logging it. Wake uses Chiaki discovery. Standby connects with audio/video
disabled, waits for `CHIAKI_EVENT_CONNECTED`, calls
`chiaki_session_goto_bed()`, and closes the session.

The CMake build applies a pinned musl compatibility patch because Home
Assistant add-on images use Alpine. Any distributed build must comply with the
AGPL-3.0-only license covering the native helper and Chiaki-derived code.
