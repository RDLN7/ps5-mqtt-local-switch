import type MQTT from "async-mqtt"
import { call, getContext } from "redux-saga/effects"

import { MQTT_CLIENT } from "../../services"
import type { UpdateHomeAssistantAction } from "../types"

function* updateHomeAssistant({ payload: device }: UpdateHomeAssistantAction) {
  const mqtt: MQTT.AsyncClient = yield getContext(MQTT_CLIENT)

  yield call<
    (
      topic: string,
      message: string | Buffer,
      opts: MQTT.IClientPublishOptions,
    ) => Promise<MQTT.IPublishPacket>
  >(
    mqtt.publish.bind(mqtt),
    `ps5-mqtt/${device.id}`,
    JSON.stringify({
      power: device.status,
      device_status: device.available ? "online" : "offline",
      activity:
        device.status === "AWAKE"
          ? device.activity !== undefined
            ? "playing"
            : "idle"
          : "none",
      players: device.activity?.activePlayers,
      title_id: device.activity?.titleId,
      title_image: device.activity?.titleImage,
      title_name: device.activity?.titleName,
      last_seen: device.lastSeen,
      latency_ms: device.latencyMs,
      credential_health: device.credentialHealth ?? "missing",
      firmware: device.systemVersion,
      transitioning: device.transitioning,
    }),
    { qos: 1, retain: true },
  )
}

export { updateHomeAssistant }
