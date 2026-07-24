import type { DiscoveryResponse, IDevice, ILogger, Stats } from "./types"

export default class Api {
  constructor(private readonly logger: ILogger) {}

  async connectToDevice(
    device: IDevice,
    pin: string,
    accountId: string,
  ): Promise<boolean> {
    try {
      const response = await fetch("api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device, pin, accountId }),
      })
      if (!response.ok) {
        this.logger.error(await response.text())
        return false
      }
      this.logger.log(`Local control paired with ${device.name}`)
      return true
    } catch (error) {
      this.logger.error(error)
      return false
    }
  }

  async getStats(): Promise<Stats | undefined> {
    try {
      const response = await fetch("api/stats", { method: "GET" })
      return await response.json()
    } catch (error) {
      this.logger.error(error)
      return undefined
    }
  }

  async getDevices(): Promise<IDevice[] | undefined> {
    try {
      const response = await fetch("api/discover", { method: "GET" })
      return ((await response.json()) as DiscoveryResponse)?.devices
    } catch (error) {
      this.logger.error(error)
      return undefined
    }
  }
}
