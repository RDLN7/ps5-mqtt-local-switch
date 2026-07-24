import React from "react"
import * as Grommet from "grommet"
import * as GrommetIcons from "grommet-icons"

import { AppContext } from "./context"
import type { IDevice } from "./types"

export const Authenticate: React.FC<{
  device: IDevice
  onDone: (success?: boolean) => Promise<void>
}> = ({ device, onDone }) => {
  const { api } = React.useContext(AppContext)
  const [authenticating, setAuthenticating] = React.useState(false)
  const [valid, setValid] = React.useState(false)

  return (
    <Grommet.Box pad="small" gap="medium" width="medium">
      <Grommet.Heading level="3" margin="none">
        Pair local control with {device.name}
      </Grommet.Heading>
      <Grommet.Form
        validate="change"
        onSubmit={async (event) => {
          const { accountId, pin } = event.value as {
            accountId: string
            pin: string
          }
          setAuthenticating(true)
          const success = await api.connectToDevice(device, pin, accountId)
          setAuthenticating(false)
          if (success) await onDone(true)
        }}
        onValidate={(result) => setValid(result.valid)}
      >
        <Grommet.Paragraph margin={{ top: "none" }}>
          Enter the Base64 Account ID for the PS5 user you will pair. It is used
          only for local Remote Play registration; no Sony sign-in or OAuth
          token is required.
        </Grommet.Paragraph>
        <Grommet.FormField
          label="Base64 Account ID"
          name="accountId"
          required
          disabled={authenticating}
          validate={[
            (value) =>
              /^[A-Za-z0-9+/]{11}=$/.test(value ?? "")
                ? undefined
                : "must be a Base64-encoded 8-byte Account ID",
          ]}
        >
          <Grommet.TextInput
            name="accountId"
            placeholder="Base64 Account ID"
            icon={<GrommetIcons.User />}
          />
        </Grommet.FormField>
        <Grommet.Paragraph margin="none">
          On the PS5, open Settings &gt; System &gt; Remote Play &gt; Link
          Device, then enter the newly generated PIN below.
        </Grommet.Paragraph>
        <Grommet.FormField
          label="Link Device PIN"
          name="pin"
          required
          disabled={authenticating}
          validate={[
            { regexp: /^[0-9]{8}$/ },
            (value) =>
              value?.length === 8 ? undefined : "must be exactly 8 digits",
          ]}
        >
          <Grommet.TextInput
            name="pin"
            placeholder="8-digit PIN"
            icon={<GrommetIcons.Key />}
          />
        </Grommet.FormField>
        <Grommet.Box
          direction="row"
          justify="between"
          margin={{ top: "medium" }}
        >
          <Grommet.Button label="Cancel" onClick={() => onDone()} />
          <Grommet.Button
            type="submit"
            label="Pair local control"
            primary
            disabled={!valid || authenticating}
            icon={authenticating ? <Grommet.Spinner /> : undefined}
          />
        </Grommet.Box>
      </Grommet.Form>
    </Grommet.Box>
  )
}
