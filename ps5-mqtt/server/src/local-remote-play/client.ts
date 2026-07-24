import { execFile } from "child_process"
import fs from "fs"
import path from "path"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

export interface LocalRemotePlayCredential {
  host: string
  regist_key: string
  rp_key: string
  rp_key_type: number
  server_mac: string
}

export type LocalCredentialHealth = "paired" | "missing" | "invalid"

interface CredentialStore {
  devices: Record<string, LocalRemotePlayCredential>
}

export interface LocalRemotePlayClient {
  register(host: string, accountId: string, pin: string): Promise<void>
  hasCredential(host: string): boolean
  credentialHealth(host: string): LocalCredentialHealth
  wake(host: string): Promise<void>
  standby(host: string, loginPasscode?: string): Promise<void>
}

export interface LocalRemotePlayClientSettings {
  credentialStoragePath: string
  helperPath: string
}

const emptyStore = (): CredentialStore => ({ devices: {} })

const isValidCredential = (
  credential: LocalRemotePlayCredential | undefined,
  host: string,
): credential is LocalRemotePlayCredential =>
  credential?.host === host &&
  /^[0-9a-fA-F]{1,16}$/.test(credential.regist_key) &&
  /^[0-9a-fA-F]{32}$/.test(credential.rp_key) &&
  Number.isInteger(credential.rp_key_type) &&
  /^[0-9a-fA-F]{12}$/.test(credential.server_mac)

export function createLocalRemotePlayClient({
  credentialStoragePath,
  helperPath,
}: LocalRemotePlayClientSettings): LocalRemotePlayClient {
  const readStore = (): CredentialStore => {
    if (!fs.existsSync(credentialStoragePath)) return emptyStore()
    const parsed = JSON.parse(
      fs.readFileSync(credentialStoragePath, "utf-8"),
    ) as CredentialStore
    return parsed.devices ? parsed : emptyStore()
  }

  const writeStore = (store: CredentialStore): void => {
    fs.mkdirSync(path.dirname(credentialStoragePath), { recursive: true })
    const temporaryPath = `${credentialStoragePath}.tmp`
    fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    })
    fs.renameSync(temporaryPath, credentialStoragePath)
  }

  const run = async (args: string[], timeout: number): Promise<string> => {
    try {
      const { stdout } = await execFileAsync(helperPath, args, {
        encoding: "utf-8",
        timeout,
        maxBuffer: 1024 * 1024,
      })
      return stdout
    } catch (error) {
      const detail =
        error && typeof error === "object" && "stderr" in error
          ? String(error.stderr).trim()
          : String(error)
      throw Object.assign(
        new Error(detail || "Local Remote Play command failed"),
        { cause: error },
      )
    }
  }

  const credentialFor = (host: string): LocalRemotePlayCredential => {
    const credential = readStore().devices[host]
    if (!isValidCredential(credential, host)) {
      throw new Error(
        `PS5 ${host} is not paired. Open the add-on Web UI and select Pair local control.`,
      )
    }
    return credential
  }

  return {
    async register(
      host: string,
      accountId: string,
      pin: string,
    ): Promise<void> {
      const stdout = await run(["register", host, accountId, pin], 45_000)
      const jsonLine = stdout
        .trim()
        .split(/\r?\n/)
        .reverse()
        .find((line) => line.startsWith("{"))
      if (!jsonLine) throw new Error("Pairing helper returned no credentials")
      const credential = JSON.parse(jsonLine) as LocalRemotePlayCredential
      if (!isValidCredential(credential, host)) {
        throw new Error("Pairing helper returned invalid credentials")
      }
      const store = readStore()
      store.devices[host] = credential
      writeStore(store)
    },

    hasCredential(host: string): boolean {
      return this.credentialHealth(host) === "paired"
    },

    credentialHealth(host: string): LocalCredentialHealth {
      if (!fs.existsSync(credentialStoragePath)) return "missing"
      try {
        const credential = readStore().devices[host]
        if (!credential) return "missing"
        return isValidCredential(credential, host) ? "paired" : "invalid"
      } catch {
        return "invalid"
      }
    },

    async wake(host: string): Promise<void> {
      const credential = credentialFor(host)
      await run(["wake", host, credential.regist_key], 10_000)
    },

    async standby(host: string, loginPasscode?: string): Promise<void> {
      const credential = credentialFor(host)
      const args = ["standby", host, credential.regist_key, credential.rp_key]
      if (loginPasscode) args.push(loginPasscode)
      await run(args, 45_000)
    },
  }
}
