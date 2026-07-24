# PS5 MQTT Local Switch for Home Assistant

This guide explains the **PS5 MQTT Local Switch** HACS integration included in
the `fishredleung/ps5-mqtt` fork. It modifies the original PS5 MQTT project to
add a local-network wake switch for a PS5 in Rest Mode without using Sony
OAuth, an NPSSO token, or a PSN account/device in Home Assistant.

The original PS5 MQTT project was created by **Florentijn Cornet (FunkeyFlo)**
and **Andrew Smith (andrew-codes)**. This fork preserves the original project
and adds the local switch authentication path described here.

> [!WARNING]
> This is an advanced, local-network setup for hardware you own. The PS5
> requires a one-time device registration; this fork does not bypass it. Keep
> your registration key private: anyone on your network who has it can send a
> wake request to the console.

## What this fork does

```text
ActRemoteLink account ID + temporary pairing PIN
              │
              ▼
      Local device registration
              │
              ▼
   Persistent registration key (regist_key)
              │
              ▼
Home Assistant sends a local UDP wake packet to the PS5
```

The resulting Home Assistant entity is a **wake switch**. Turning it on asks a
PS5 in Rest Mode to wake. This is not a Remote Play or game-streaming project;
the Remote Play protocol is used only for the local registration mechanism.

## Requirements

Before starting, make sure you have all of the following:

- A PS5 and Home Assistant on the same LAN or VLAN with UDP traffic permitted.
- A stable PS5 IP address; a DHCP reservation is strongly recommended.
- PS5 Remote Play enabled, and Rest Mode configured to remain connected to the
  network.
- A jailbroken PS5 with a payload loader only if you use ActRemoteLink to
  create the offline pairing PIN.
- The intended local PS5 user signed in and active in the foreground during
  pairing.
- HACS installed in Home Assistant.
- A computer with CMake, a C compiler, Git, and development libraries to build
  the local registration helper.

## 1. Prepare the PS5

1. Sign in to the local PS5 account that you want to associate with Remote
   Play.
2. In **Settings → System → Remote Play**, enable Remote Play if the option is
   available.
3. In **Settings → System → Power Saving → Features Available in Rest Mode**,
   enable the network option that allows the PS5 to remain reachable in Rest
   Mode.
4. Leave this user active on screen while generating and using the pairing
   PIN.

Do not change the account ID of an existing primary user with saves unless you
have a backup and understand the consequences. A separate local user is the
safer choice for offline activation.

## 2. Generate a pairing PIN with ActRemoteLink

Start the ActRemoteLink agent and generate a PIN for the currently active user:

```bash
python3 actremotelink_sender.py --host PS5_IP start
python3 actremotelink_sender.py --host PS5_IP pin
```

Record both values shown in the output:

```text
pin=1234 5678
account_id_base64=EXAMPLE_BASE64_ACCOUNT_ID
```

The PIN expires quickly (normally five minutes). Generate it immediately
before the registration step below.

## 3. Create a local registration key

The source helper is in `native/local-remote-play`. It uses the local
Chiaki/CloudPad registration flow: the Base64 account ID and eight-digit PIN
are exchanged directly with the PS5 to create a `regist_key`.

From the repository root:

```bash
cmake -S native/local-remote-play -B build/local-remote-play
cmake --build build/local-remote-play
./build/local-remote-play/ps5-mqtt-local-rp register \
  PS5_IP BASE64_ACCOUNT_ID EIGHT_DIGIT_PIN
```

Expected output:

```json
{"regist_key":"0123abcd"}
```

Save this value in a password manager. Do not share it in GitHub issues, Home
Assistant logs, screenshots, or chat messages.

If registration fails, generate a new ActRemoteLink PIN, confirm the intended
PS5 user is foreground, and retry while the console is awake and reachable.

## 4. Install the integration with HACS

1. In Home Assistant, open **HACS → Integrations**.
2. Open the menu and choose **Custom repositories**.
3. Add `https://github.com/fishredleung/ps5-mqtt`.
4. Set the category to **Integration** and save.
5. Find **PS5 MQTT Local Switch**, install it, and restart Home Assistant.

## 5. Configure the PS5 wake switch

1. Open **Settings → Devices & services**.
2. Select **Add integration**.
3. Search for **PS5 MQTT Local Switch**.
4. Enter the PS5 IP address and the `regist_key` created in step 3.
5. Finish setup.

Home Assistant creates a `Power` switch. Turn it on to send a local,
Chiaki-compatible UDP wake packet to port `9302` on the PS5.

## Normal use

- Put the PS5 into **Rest Mode**, not a full shutdown.
- Turn on the Home Assistant `Power` switch when you want to wake it.
- After the console wakes, use your registered Remote Play client normally.

The switch is intentionally optimistic: the PS5 discovery protocol does not
return a dependable acknowledgement, so Home Assistant records that it sent a
wake request rather than proving the console completed startup.

## Troubleshooting

### The switch turns on, but the PS5 stays asleep

- Confirm the console is in Rest Mode, not fully powered down.
- Confirm the PS5 IP address has not changed.
- Confirm Home Assistant can route to the PS5 VLAN and UDP port `9302` is not
  blocked.
- Re-check the Rest Mode network settings and Remote Play setting.
- Generate a new `regist_key` if the saved key is wrong or was created for a
  different PS5/user pairing.

### Registration rejects the PIN

- The PIN has probably expired; generate a fresh one.
- Make sure the intended account is the active foreground user on the PS5.
- Use the Base64 account ID exactly as ActRemoteLink prints it.
- Ensure the PS5 is awake and reachable from the machine running the helper.

### I need remote power-off or a real state sensor

This integration only implements the local wake request. The Remote Play
discovery protocol does not provide reliable remote shutdown or authoritative
power state. Keep the original PS5 MQTT add-on if you need its existing MQTT
entities and behaviour.

## Security and licensing

- The registration key is a credential. Keep it out of source control and
  public configuration exports.
- The helper imports CloudPad/Chiaki-derived code under **AGPL-3.0-only**. Any
  distributed binary containing that helper must comply with that licence.
- The original PS5 MQTT source remains MIT-licensed; see `LICENSE.md` and the
  relevant third-party notices for attribution.
