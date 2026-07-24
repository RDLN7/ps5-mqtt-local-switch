import type MQTT from "async-mqtt"
import { call, getContext, put } from "redux-saga/effects"

import { MQTT_CLIENT, SETTINGS, Settings } from "../../services"
import { HaMqtt } from "../../util/ha-mqtt"
import { addDevice, updateHomeAssistant } from "../action-creators"
import type { RegisterDeviceAction } from "../types"

function* registerDevice({ payload: device }: RegisterDeviceAction) {
  const mqtt: MQTT.AsyncClient = yield getContext(MQTT_CLIENT)
  const { discoveryTopic }: Settings = yield getContext(SETTINGS)

  const deviceConfig = HaMqtt.getMqttDeviceConfig(device)

  yield call<
    (
      topic: string,
      message: string | Buffer,
      { qos, retain }: MQTT.IClientPublishOptions,
    ) => Promise<MQTT.IPublishPacket>
  >(
    mqtt.publish.bind(mqtt),
    `${discoveryTopic}/switch/${device.id}/power/config`,
    // https://www.home-assistant.io/integrations/switch.mqtt/
    JSON.stringify(<HaMqtt.Config.MqttSwitchEntity>{
      availability: [
        {
          topic: `ps5-mqtt/${device.id}`,
          value_template: "{{ value_json.device_status }}",
        },
      ],
      name: "power",
      command_topic: `ps5-mqtt/${device.id}/set/power`,
      state_topic: `ps5-mqtt/${device.id}`,
      unique_id: `${device.id}_power_ps5mqtt`,
      state_on: "AWAKE",
      state_off: "STANDBY",
      payload_on: "AWAKE",
      payload_off: "STANDBY",
      optimistic: false,
      value_template: "{{ value_json.power }}",
      icon: "mdi:sony-playstation",
      device: deviceConfig,
    }),
    { qos: 1, retain: true },
  )

  yield call<
    (
      topic: string,
      message: string | Buffer,
      { qos, retain }: MQTT.IClientPublishOptions,
    ) => Promise<MQTT.IPublishPacket>
  >(
    mqtt.publish.bind(mqtt),
    `${discoveryTopic}/sensor/${device.id}/activity/config`,
    JSON.stringify(<HaMqtt.Config.MqttSensorEntity>{
      availability: [
        {
          topic: `ps5-mqtt/${device.id}`,
          value_template: "{{ value_json.device_status }}",
        },
      ],
      unique_id: `${device.id}_activity_ps5mqtt`,
      state_topic: `ps5-mqtt/${device.id}`,
      name: "activity",
      device: deviceConfig,
      enabled_by_default: true,
      json_attributes_topic: `ps5-mqtt/${device.id}`,
      value_template: "{{ value_json.activity }}",
    }),
    { qos: 1, retain: true },
  )

  const diagnostics: Array<
    [string, HaMqtt.Config.MqttSensorEntity]
  > = [
    [
      "last_seen",
      {
        unique_id: `${device.id}_last_seen_ps5mqtt`,
        object_id: `${device.id}_last_seen`,
        state_topic: `ps5-mqtt/${device.id}`,
        name: "last seen",
        device_class: "timestamp",
        entity_category: "diagnostic",
        value_template:
          "{{ value_json.last_seen if value_json.last_seen else 'unknown' }}",
        device: deviceConfig,
      },
    ],
    [
      "latency",
      {
        unique_id: `${device.id}_latency_ps5mqtt`,
        object_id: `${device.id}_latency`,
        state_topic: `ps5-mqtt/${device.id}`,
        name: "latency",
        icon: "mdi:timer-outline",
        unit_of_measurement: "ms",
        state_class: "measurement",
        entity_category: "diagnostic",
        value_template:
          "{{ value_json.latency_ms if value_json.latency_ms is not none else 'unknown' }}",
        device: deviceConfig,
      },
    ],
    [
      "credential_health",
      {
        unique_id: `${device.id}_credential_health_ps5mqtt`,
        object_id: `${device.id}_credential_health`,
        state_topic: `ps5-mqtt/${device.id}`,
        name: "credential health",
        icon: "mdi:key-check",
        entity_category: "diagnostic",
        value_template: "{{ value_json.credential_health }}",
        device: deviceConfig,
      },
    ],
    [
      "firmware",
      {
        unique_id: `${device.id}_firmware_ps5mqtt`,
        object_id: `${device.id}_firmware`,
        state_topic: `ps5-mqtt/${device.id}`,
        name: "firmware",
        icon: "mdi:chip",
        entity_category: "diagnostic",
        value_template: "{{ value_json.firmware }}",
        device: deviceConfig,
      },
    ],
  ]

  for (const [objectId, config] of diagnostics) {
    yield call<
      (
        topic: string,
        message: string | Buffer,
        opts: MQTT.IClientPublishOptions,
      ) => Promise<MQTT.IPublishPacket>
    >(
      mqtt.publish.bind(mqtt),
      `${discoveryTopic}/sensor/${device.id}/${objectId}/config`,
      JSON.stringify(config),
      { qos: 1, retain: true },
    )
  }

  yield put(addDevice(device))

  yield put(updateHomeAssistant(device))
}

export { registerDevice }
