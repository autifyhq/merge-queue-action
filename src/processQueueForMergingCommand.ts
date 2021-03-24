import * as core from "@actions/core"
import { graphqlClient } from "./graphqlClient"
import {
  mergeBranch,
  removeLabel,
  addLabel,
  stopMergingCurrentPrAndProcessNextPrInQueue,
  mergePr,
} from "./mutations"
import {
  isBotMergingLabel,
  isBotQueuedLabel,
  isCommandQueueForMergingLabel,
} from "./labels"
import { PullRequest, Repository } from "@octokit/webhooks-definitions/schema"

/**
 *
 * @param pr PR data from the webhook
 * @param repo Reposotiry data from the webhook
 */
export async function processQueueForMergingCommand(
  pr: PullRequest,
  repo: Repository
): Promise<void> {
  const {
    repository: {
      labels: { nodes: labelNodes },
    },
  } = await fetchData(repo.owner.login, repo.name)

  // Remove `command:queue-for-merging` label
  const commandLabel = labelNodes.find(isCommandQueueForMergingLabel)
  if (!commandLabel) {
    return
  }
  await removeLabel(commandLabel, pr.node_id)

  const mergingLabel = labelNodes.find(isBotMergingLabel)
  const queuedLabel = labelNodes.find(isBotQueuedLabel)

  // Create bot labels if not existed
  if (!mergingLabel) {
    // TODO: Create bot:merging label on the fly
    return
  }
  if (!queuedLabel) {
    // TODO: Create bot:queued label on the fly
    return
  }

  // Ignore PR that's already processed
  if (pr.labels.find(isBotMergingLabel)) {
    core.info("PR already in the merging process.")
    return
  } else if (pr.labels.find(isBotQueuedLabel)) {
    core.info("PR already in the queue.")
    return
  }

  // Add either `bot:merging` or `bot:queued`
  // `bot:merging` is not in any PR yet. -> Add `bot:merging`
  // `bot:merging` is already in some other PR. -> Add `bot:queued`
  const labelToAdd =
    mergingLabel.pullRequests.nodes.length === 0 ? mergingLabel : queuedLabel

  await addLabel(labelToAdd, pr.node_id)

  // Finish the process if not added `bot:merging`
  if (!isBotMergingLabel(labelToAdd)) {
    return
  }

  // Try to make the PR up-to-date
  try {
    await mergeBranch(pr.head.ref, pr.base.ref, repo.node_id)
    core.info("Make PR up-to-date")
  } catch (error) {
    if (error.message === 'Failed to merge: "Already merged"') {
      core.info("PR already up-to-date.")
      try {
        await mergePr(
          {
            title: pr.title,
            number: pr.number,
            baseRef: { name: pr.base.ref },
            headRef: { name: pr.head.ref },
          },
          repo.node_id
        )
      } catch (mergePrError) {
        core.info("Unable to merge the PR")
        core.error(mergePrError)
      }
    }
    stopMergingCurrentPrAndProcessNextPrInQueue(
      mergingLabel,
      queuedLabel,
      pr.node_id,
      repo.node_id
    )
  }
}

/**
 * Fetch all the data for processing bot command webhook
 * @param owner Organization name
 * @param repo Repository name
 */
async function fetchData(
  owner: string,
  repo: string
): Promise<{
  repository: {
    labels: {
      nodes: {
        id: string
        name: string
        pullRequests: {
          nodes: {
            id: string
            baseRef: { name: string }
            headRef: { name: string }
          }[]
        }
      }[]
    }
  }
}> {
  return graphqlClient(
    `query allLabels($owner: String!, $repo: String!) {
         repository(owner:$owner, name:$repo) {
           labels(last: 50) {
             nodes {
               id
               name
               pullRequests(first: 20) {
                 nodes {
                   id
                   baseRef {
                     name
                   }
                   headRef {
                     name
                   }
                 }
               }
             }
           }
         }
       }`,
    { owner, repo }
  )
}
