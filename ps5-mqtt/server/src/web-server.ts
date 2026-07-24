import bodyParser from "body-parser"
import createDebugger from "debug"
import express, { Express } from "express"
import path from "path"

import { Discovery } from "playactor/dist/discovery"
import { DeviceType, IDiscoveredDevice } from "playactor/dist/discovery/model"

import type { LocalRemotePlayClient } from "./local-remote-play/client"
import { Settings } from "./services"
import { createErrorLogger } from "./util/error-logger"

const debug = createDebugger("@ha:ps5:webserver")
const logError = createErrorLogger()

let app: Express | undefined = undefined

export function setupWebserver(
  port: number | string,
  { allowPs4Devices, deviceDiscoveryBroadcastAddress }: Settings,
  localRemotePlayClient: LocalRemotePlayClient,
): Express {
  if (app !== undefined) {
    throw Error("web server is already running")
  }

  app = express()

  app.use(
    "/",
    express.static(path.join(__dirname, "..", "..", "client", "dist")),
  )
  app.use(bodyParser.json())

  app.get("/api/discover", async (_req, res) => {
    try {
      const discovery = new Discovery({
        timeoutMillis: 5000,
        deviceIp: deviceDiscoveryBroadcastAddress,
      })
      const devices: IDiscoveredDevice[] = []
      for await (const device of discovery.discover()) {
        if (!(!allowPs4Devices && device.type === DeviceType.PS4)) {
          devices.push(device)
        }
      }
      res.send({ devices })
    } catch (error) {
      logError(error)
      res.status(500).send()
    }
  })

  app.post("/api/connect", async (req, res) => {
    try {
      const { device, accountId, pin } = req.body as {
        device: IDiscoveredDevice
        accountId: string
        pin: string
      }
      if (!device.address?.address) {
        throw new Error("Discovered device has no IP address")
      }
      debug(`pairing local control for device: '${device.id}'`)
      await localRemotePlayClient.register(
        device.address.address,
        accountId,
        pin,
      )
      res.status(201).send()
    } catch (error) {
      logError(error)
      res.status(500).send(error?.toString())
    }
  })

  app.listen(port, () => {
    debug("Server listening on PORT:", port)
  })

  return app
}
