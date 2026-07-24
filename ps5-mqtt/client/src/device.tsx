import * as Grommet from "grommet"
import * as GrommetIcons from "grommet-icons"
import React from "react"
import { Authenticate } from "./authenticate"
import type { IDevice } from "./types"

export const Device: React.FC<{ device: IDevice }> = ({ device }) => {
  const [showPairing, setShowPairing] = React.useState(false)

  const onAuthExit = async () => {
    setShowPairing(false)
  }

  return (
    <>
      <Grommet.Card
        animation={[
          { type: "zoomIn", duration: 500, size: "large" },
          { type: "fadeIn", duration: 500, size: "large" },
        ]}
      >
        <Grommet.CardHeader pad="medium">
          <Grommet.Heading level="2" margin={{ vertical: "none" }}>
            {device.name}
          </Grommet.Heading>
        </Grommet.CardHeader>
        <Grommet.CardBody pad={{ bottom: "medium" }} height="large">
          <Grommet.DataTable
            columns={[
              { property: "key", primary: true, header: "Property" },
              { property: "value", header: "Value" },
            ]}
            data={Object.keys(device)
              .filter((k) => k !== "extras")
              .sort()
              .map((key) => ({
                key,
                value:
                  typeof device[key] === "object"
                    ? JSON.stringify(device[key])
                    : device[key],
              }))}
            step={10}
          />
        </Grommet.CardBody>
        <Grommet.CardFooter pad={{ horizontal: "small" }}>
          <Grommet.Button
            icon={<GrommetIcons.Connect size="medium" />}
            onClick={() => setShowPairing(true)}
            hoverIndicator
            tip={"Pair local control"}
          />
        </Grommet.CardFooter>
      </Grommet.Card>

      {showPairing && (
        <Grommet.Layer onEsc={onAuthExit} onClickOutside={onAuthExit}>
          <Authenticate onDone={onAuthExit} device={device} />
        </Grommet.Layer>
      )}
    </>
  )
}
