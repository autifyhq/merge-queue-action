import * as core from "@actions/core"
import * as fs from "fs"
import { processQueueForMergingCommand } from "./processQueueForMergingCommand"
import { processNonPendingStatus } from "./processNonPendingStatus"
import { isCommandQueueForMergingLabel } from "./labels"
import { exit } from "process"
import {
  PullRequestEvent,
  StatusEvent,
  WebhookEvent,
} from "@octokit/webhooks-definitions/schema"

if (!process.env.GITHUB_EVENT_PATH) {
  core.setFailed("GITHUB_EVENT_PATH is not available")
  exit(1)
}

const eventName = process.env.GITHUB_EVENT_NAME
const eventPayload: WebhookEvent = JSON.parse(
  fs.readFileSync(process.env.GITHUB_EVENT_PATH).toString()
)

async function run(): Promise<void> {
  try {
    if (eventName === "pull_request") {
      await processPullRequestEvent(eventPayload as PullRequestEvent)
    } else if (eventName === "status") {
      await processStatusEvent(eventPayload as StatusEvent)
    } else {
      core.info(`Event does not need to be processed: ${eventName}`)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

async function processPullRequestEvent(
  pullRequestEvent: PullRequestEvent
): Promise<void> {
  if (
    pullRequestEvent.action !== "labeled" ||
    !isCommandQueueForMergingLabel(pullRequestEvent.label)
  ) {
    return
  }
  await processQueueForMergingCommand(
    pullRequestEvent.pull_request,
    pullRequestEvent.repository
  )
  core.info("Finish process queue-for-merging command")
}

async function processStatusEvent(statusEvent: StatusEvent): Promise<void> {
  if (statusEvent.state === "pending") {
    return
  }
  await processNonPendingStatus(
    statusEvent.repository,
    statusEvent.commit,
    statusEvent.context,
    statusEvent.state
  )
  core.info("Finish process status event")
}
