"""A PSN-free wake switch for a locally registered PS5."""

from __future__ import annotations

import socket
from datetime import timedelta

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import ATTR_ENTITY_ID, SERVICE_TURN_OFF
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_HOST, CONF_REGIST_KEY, DOMAIN, PS5_DISCOVERY_PORT, PS5_DISCOVERY_PROTOCOL


SCAN_INTERVAL = timedelta(seconds=30)
DISCOVERY_TIMEOUT = 3


def _send_wakeup(host: str, regist_key: str) -> None:
    """Send the Chiaki-compatible local PS5 wake packet over UDP."""
    packet = (
        "WAKEUP * HTTP/1.1\n"
        "client-type:vr\n"
        "auth-type:R\n"
        "model:w\n"
        "app-type:r\n"
        f"user-credential:{int(regist_key, 16)}\n"
        f"device-discovery-protocol-version:{PS5_DISCOVERY_PROTOCOL}\n"
    ).encode()
    address = socket.getaddrinfo(host, PS5_DISCOVERY_PORT, type=socket.SOCK_DGRAM)[0][4]
    with socket.socket(socket.AF_INET6 if len(address) == 4 else socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.sendto(packet, address)


def _get_power_state(host: str) -> bool | None:
    """Query the local PS5 discovery endpoint for its real power state."""
    request = (
        "SRCH * HTTP/1.1\n"
        f"device-discovery-protocol-version:{PS5_DISCOVERY_PROTOCOL}\n"
    ).encode()
    address = socket.getaddrinfo(host, PS5_DISCOVERY_PORT, type=socket.SOCK_DGRAM)[0][4]

    with socket.socket(socket.AF_INET6 if len(address) == 4 else socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.settimeout(DISCOVERY_TIMEOUT)
        sock.sendto(request, address)
        response, _ = sock.recvfrom(1024)

    status_line = response.decode("ascii", errors="ignore").splitlines()[0] if response else ""
    if " 200 " in status_line:
        return True
    if " 620 " in status_line:
        return False
    return None


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    """Create one wake switch per configured PS5."""
    async_add_entities([Ps5LocalWakeSwitch(entry)])


class Ps5LocalWakeSwitch(SwitchEntity):
    """Wake the PS5 from Rest Mode using its local registration key."""

    _attr_has_entity_name = True
    _attr_name = "Power"
    _attr_icon = "mdi:sony-playstation"
    _attr_should_poll = True

    def __init__(self, entry: ConfigEntry) -> None:
        self._entry = entry
        self._host = entry.data[CONF_HOST]
        self._regist_key = entry.data[CONF_REGIST_KEY]
        self._attr_unique_id = f"{self._host}_local_remote_play_power"
        self._attr_is_on = None
        self._attr_available = True
        self._attr_device_info = {
            "identifiers": {(DOMAIN, self._host)},
            "name": f"PS5 ({self._host})",
            "manufacturer": "Sony",
            "model": "PlayStation 5",
        }

    async def async_added_to_hass(self) -> None:
        """Publish a real state immediately instead of waiting for the first poll."""
        await super().async_added_to_hass()
        await self.async_update()

    def _mqtt_power_entity(self) -> str | None:
        """Find the PS5 MQTT power switch for this host, if it is installed.

        The local registration credential can wake a console but cannot put it
        into Rest Mode. PS5 MQTT has the authenticated Remote Play controller
        required for standby, so use it when it manages this same IP address.
        """
        entity_registry = er.async_get(self.hass)
        device_registry = dr.async_get(self.hass)
        for candidate in entity_registry.entities.values():
            if (
                not candidate.entity_id.startswith("switch.")
                or candidate.platform == DOMAIN
                or not candidate.entity_id.endswith("_power")
                or candidate.device_id is None
            ):
                continue
            device = device_registry.async_get(candidate.device_id)
            if device is not None and ("ip", self._host) in device.connections:
                return candidate.entity_id
        return None

    async def _async_call_mqtt_power(self, service: str) -> bool:
        """Call the matching PS5 MQTT power entity when available."""
        entity_id = self._mqtt_power_entity()
        if entity_id is None:
            return False
        await self.hass.services.async_call(
            "switch", service, {ATTR_ENTITY_ID: entity_id}, blocking=True
        )
        return True

    async def async_turn_on(self, **kwargs: object) -> None:
        """Wake the console. The key works only while it is in Rest Mode."""
        await self.hass.async_add_executor_job(_send_wakeup, self._host, self._regist_key)
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: object) -> None:
        """Put the console into Rest Mode through PS5 MQTT when available."""
        if not await self._async_call_mqtt_power(SERVICE_TURN_OFF):
            raise HomeAssistantError(
                "Rest Mode requires the PS5 MQTT power controller for this PS5"
            )
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_update(self) -> None:
        """Refresh the state from the PS5's local discovery response."""
        try:
            state = await self.hass.async_add_executor_job(_get_power_state, self._host)
        except (OSError, socket.timeout):
            state = None

        self._attr_available = state is not None
        if state is not None:
            self._attr_is_on = state
