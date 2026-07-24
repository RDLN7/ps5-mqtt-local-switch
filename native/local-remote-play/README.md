# Local Remote Play helper

This helper implements the PSN-free path:

`ActRemoteLink account ID + generated PIN -> Chiaki registration key -> PS5 wake packet`

It uses CloudPad/Chiaki code under AGPL-3.0-only. Any distributed add-on image
that includes it must comply with that licence. It still needs wiring into the
Home Assistant web UI and persistent credential store before it replaces the
existing OAuth registration flow.
