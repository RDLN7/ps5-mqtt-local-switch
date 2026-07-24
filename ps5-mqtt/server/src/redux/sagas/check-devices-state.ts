import createDebugger from "debug"
import { call, getContext, put, select } from "redux-saga/effects"
import type { PlayactorClient } from "../../playactor/client"
import { PLAYACTOR_CLIENT } from "../../services"
import { createErrorLogger } from "../../util/error-logger"
import { updateHomeAssistant } from "../action-creators"
import { getDeviceList } from "../selectors"
import type { Device } from "../types"

const debug = createDebugger("@ha:ps5:checkDevicesState")
const errorLogger = createErrorLogger()

function* checkDevicesState() {
  const playactor: PlayactorClient = yield getContext(PLAYACTOR_CLIENT)
  const devices: Device[] = yield select(getDeviceList)

  for (const device of devices) {
    const checkedAt = Date.now()

    try {
      const updatedDevice: Device = yield call(
        [playactor, playactor.check],
        device.address.address,
      )
      const lastSeen = new Date().toISOString()
      const latencyMs = Date.now() - checkedAt
      const credentialHealth = playactor.credentialHealth(
        device.address.address,
      )

      if (device.transitioning) {
        debug(
          "Device is transitioning",
          device.transitioning,
          updatedDevice.status,
        )
        continue
      }

      debug("Update HA")
      yield put(
        updateHomeAssistant({
          ...device,
          ...updatedDevice,
          status: updatedDevice.status,
          activity:
            updatedDevice.status !== "AWAKE"
              ? undefined
              : updatedDevice.activity,
          available: true,
          lastSeen,
          latencyMs,
          credentialHealth,
        }),
      )
    } catch (e) {
      yield put(
        updateHomeAssistant({
          ...device,
          status: "UNKNOWN",
          available: false,
          activity: undefined,
          latencyMs: null,
          credentialHealth: playactor.credentialHealth(
            device.address.address,
          ),
        }),
      )
      errorLogger(e)
    }
  }
}

export { checkDevicesState }
