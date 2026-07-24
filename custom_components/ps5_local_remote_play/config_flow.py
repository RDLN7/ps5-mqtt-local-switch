"""Config flow for PS5 Local Remote Play."""

from __future__ import annotations

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow
from homeassistant.data_entry_flow import FlowResult

from .const import CONF_HOST, CONF_REGIST_KEY, DOMAIN


class Ps5LocalRemotePlayConfigFlow(ConfigFlow, domain=DOMAIN):
    """Configure a PS5 with a locally created Remote Play registration key."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, str] | None = None
    ) -> FlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            host = user_input[CONF_HOST].strip()
            key = user_input[CONF_REGIST_KEY].strip().lower()
            if not 1 <= len(key) <= 16 or any(char not in "0123456789abcdef" for char in key):
                errors[CONF_REGIST_KEY] = "invalid_registration_key"
            else:
                await self.async_set_unique_id(host)
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title=f"PS5 ({host})", data={
                    CONF_HOST: host,
                    CONF_REGIST_KEY: key,
                })

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_HOST): str,
                vol.Required(CONF_REGIST_KEY): str,
            }),
            errors=errors,
        )
