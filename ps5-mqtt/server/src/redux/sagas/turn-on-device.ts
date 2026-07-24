import lodash from "lodash"
import { call, delay, getContext, put } from "redux-saga/effects"
import type { PlayactorClient } from "../../playactor/client"
import { PLAYACTOR_CLIENT } from "../../services"
import { createErrorLogger } from "../../util/error-logger"
import { setTransitioning, updateHomeAssistant } from "../action-creators"
import type { ChangePowerModeAction, Device } from "../types"

const debugError = createErrorLogger()
const WAKE_VERIFY_TIMEOUT_MS = 30000
const WAKE_VERIFY_INTERVAL_MS = 2000

function* turnOnDevice(action: ChangePowerModeAction) {
  if (action.payload.mode !== "AWAKE") {
    return
  }

  const playactor: PlayactorClient = yield getContext(PLAYACTOR_CLIENT)

  yield put(
    setTransitioning(
      lodash.merge({}, action.payload.device, { transitioning: true }),
    ),
  )

  try {
    const host = action.payload.device.address.address

    yield call([playactor, playactor.wake], host)

    const deadline = Date.now() + WAKE_VERIFY_TIMEOUT_MS

    while (Date.now() < deadline) {
      const checkedAt = Date.now()

      try {
        const verifiedDevice: Device = yield call(
          [playactor, playactor.check],
          host,
        )

        if (verifiedDevice.status === "AWAKE") {
          yield put(
            updateHomeAssistant({
              ...action.payload.device,
              ...verifiedDevice,
              status: "AWAKE",
              available: true,
              lastSeen: new Date().toISOString(),
              latencyMs: Date.now() - checkedAt,
              credentialHealth: playactor.credentialHealth(host),
            }),
          )
          return
        }
      } catch (e) {
        debugError(e)
      }

      const remainingMs = deadline - Date.now()
      if (remainingMs > 0) {
        yield delay(Math.min(WAKE_VERIFY_INTERVAL_MS, remainingMs))
      }
    }
  } catch (e) {
    debugError(e)
  } finally {
    yield put(
      setTransitioning(
        lodash.merge({}, action.payload.device, {
          transitioning: false,
        }),
      ),
    )
  }
}

export { turnOnDevice }
