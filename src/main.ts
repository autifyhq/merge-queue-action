import * as core from "@actions/core"
import * as fs from "fs"
import { processQueueForMergingCommand } from "./processQueueForMergingCommand"
import { processStatusRequest } from "./processStatusRequest"
import { isCommandQueueForMergingLabel } from "./labels"
import { exit } from "process"

if (!process.env.GITHUB_EVENT_PATH) {
  core.setFailed("GITHUB_EVENT_PATH is not available")
  exit(1)
}

const eventName = process.env.GITHUB_EVENT_NAME
const eventPayload = JSON.parse(
  fs.readFileSync(process.env.GITHUB_EVENT_PATH).toString()
)

async function run(): Promise<void> {
  try {
    if (eventName === "pull_request") {
      if (
        eventPayload.action === "labeled" &&
        isCommandQueueForMergingLabel(eventPayload.label)
      ) {
        await processQueueForMergingCommand(
          eventPayload.pull_request,
          eventPayload.repository
        )
        core.info("Finish process queue-for-merging command")
      }
    }

    if (eventName === "status") {
      if (
        eventPayload.state === "success" ||
        eventPayload.state === "failure"
      ) {
        await processStatusRequest(
          eventPayload.repository,
          eventPayload.commit,
          eventPayload.context,
          eventPayload.state
        )
        core.info("Finish process status event")
      }
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
