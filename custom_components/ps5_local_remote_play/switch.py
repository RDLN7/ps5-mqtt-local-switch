"""A PSN-free wake switch for a locally registered PS5."""

from __future__ import annotations

import socket

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_HOST, CONF_REGIST_KEY, DOMAIN, PS5_DISCOVERY_PORT, PS5_DISCOVERY_PROTOCOL


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

    def __init__(self, entry: ConfigEntry) -> None:
        self._entry = entry
        self._host = entry.data[CONF_HOST]
        self._regist_key = entry.data[CONF_REGIST_KEY]
        self._attr_unique_id = f"{self._host}_local_remote_play_power"
        self._attr_is_on = False
        self._attr_device_info = {
            "identifiers": {(DOMAIN, self._host)},
            "name": f"PS5 ({self._host})",
            "manufacturer": "Sony",
            "model": "PlayStation 5",
        }

    async def async_turn_on(self, **kwargs: object) -> None:
        """Wake the console. The key works only while it is in Rest Mode."""
        await self.hass.async_add_executor_job(_send_wakeup, self._host, self._regist_key)
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: object) -> None:
        """Remote Play cannot power a PS5 off; mark the optimistic wake state off."""
        self._attr_is_on = False
        self.async_write_ha_state()
