import * as core from "@actions/core"
import { graphqlClient } from "./graphqlClient"
import {
  stopMergingCurrentPrAndProcessNextPrInQueue,
  mergePr,
  removeLabel,
} from "./mutations"
import { isBotMergingLabel, isBotQueuedLabel } from "./labels"
import { Repository } from "@octokit/webhooks-definitions/schema"

/**
 *
 * @param repo Repository object
 * @param commit Commit object
 * @param context Check name
 * @param state Status state
 */
export async function processNonPendingStatus(
  repo: Repository,
  commit: { node_id: string },
  context: string,
  state: "success" | "failure" | "error"
): Promise<void> {
  const {
    repository: {
      branchProtectionRules,
      labels: { nodes: labelNodes },
    },
  } = await fetchData(repo.owner.login, repo.name)

  const mergingLabel = labelNodes.find(isBotMergingLabel)

  if (!mergingLabel || mergingLabel.pullRequests.nodes.length === 0) {
    // No merging PR to process
    return
  }

  const mergingPr = mergingLabel.pullRequests.nodes[0]
  const latestCommit = mergingPr.commits.nodes[0].commit
  if (commit.node_id !== latestCommit.id) {
    // Commit that trigger this hook is not the latest commit of the merging PR
    return
  }
  const baseBranchRule = branchProtectionRules.nodes.find(
    (rule) => rule.pattern === mergingPr.baseRef.name
  )
  if (!baseBranchRule) {
    // TODO: No protection rule for merging this PR. Merge immediately?
    return
  }
  const requiredCheckNames = baseBranchRule.requiredStatusCheckContexts

  if (state === "success") {
    const isAllRequiredCheckPassed = requiredCheckNames.every((checkName) => {
      if (!checkName.includes("ci/circleci")) {
        // TODO: Support GitHub Action. Can't get `statusCheckRollup` to work in GitHub API Explorer for some reason.
        return true
      }
      return latestCommit.status.contexts.find(
        (latestCommitContext) =>
          latestCommitContext.context === checkName &&
          latestCommitContext.state === "SUCCESS"
      )
    })
    if (!isAllRequiredCheckPassed) {
      // Some required check is still pending
      return
    }

    core.info("##### ALL CHECK PASS")
    try {
      await mergePr(mergingPr, repo.node_id)
      // TODO: Delete head branch of that PR (maybe)(might not if merge unsuccessful)
    } catch (error) {
      core.info("Unable to merge the PR.")
      core.error(error)
    }
  } else {
    if (!requiredCheckNames.includes(context)) {
      // The failed check from this webhook is not in the required status check, so we can ignore it.
      return
    }
  }

  const queuedLabel = labelNodes.find(isBotQueuedLabel)
  if (!queuedLabel) {
    await removeLabel(mergingLabel, mergingPr.id)
    return
  }
  await stopMergingCurrentPrAndProcessNextPrInQueue(
    mergingLabel,
    queuedLabel,
    mergingPr.id,
    repo.node_id
  )
}

/**
 * Fetch all the data for processing success status check webhook
 * @param owner Organzation name
 * @param repo Repository name
 */
async function fetchData(
  owner: string,
  repo: string
): Promise<{
  repository: {
    branchProtectionRules: {
      nodes: { pattern: string; requiredStatusCheckContexts: string[] }[]
    }
    labels: {
      nodes: {
        id: string
        name: string
        pullRequests: {
          nodes: {
            id: string
            number: number
            title: string
            baseRef: { name: string }
            headRef: { name: string }
            commits: {
              nodes: {
                id: string
                commit: {
                  id: string
                  status: {
                    contexts: {
                      context: string
                      state: "SUCCESS" | "PENDING" | "FAILURE"
                    }[]
                  }
                }
              }[]
            }
          }[]
        }
      }[]
    }
  }
}> {
  return graphqlClient(
    `query allLabels($owner: String!, $repo: String!) {
         repository(owner:$owner, name:$repo) {
           branchProtectionRules(last: 10) {
             nodes {
               pattern
               requiredStatusCheckContexts
             }
           }
           labels(last: 50) {
             nodes {
               id
               name
               pullRequests(first: 20) {
                 nodes {
                   id
                   number
                   title
                   baseRef {
                     name
                   }
                   headRef {
                     name
                   }
                   commits(last: 1) {
                     nodes {
                       commit {
                         id
                         status {
                           contexts {
                             context
                             state
                           }
                         }
                       }
                     }
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
