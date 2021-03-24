<p align="center">
  <a href="https://github.com/autifyhq/merge-queue-action/actions"><img alt="merge-queue-action status" src="https://github.com/autifyhq/merge-queue-action/workflows/build-test/badge.svg"></a>
</p>

# Merge Queue Action

_This action is created based on [TypeScript Action Template](https://github.com/actions/typescript-action)._

## Setup

1. Create the following labels to your repository:
   - `command:queue-for-merging`
   - `bot:merging`
   - `bot:queued`
2. Create `.github/workflows/merge-queue.yml` in your repository with the following content:

   ```yml
   name: merge-queue

   on:
     status:
     pull_request:
       types:
         - labeled

   jobs:
     merge-queue:
       runs-on: ubuntu-latest
       steps:
         - uses: autifyhq/merge-queue-action@v0.1.0
           env:
             GITHUB_TOKEN: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
   ```

   The access token needs to have `repo` permission, and it has to have an owner access to the repository as well, otherwise it wouldn't be able to get the branch protection requirement from the API.

## Usage

You can merge a PR by adding `command:queue-for-merging` label to your PR. The action will take care of the rest.

- If there’s no merging PR, the PR will be a merging PR (`bot:merging`)
- If there a merging PR already, the PR will be in the queue (`bot:queued`)

The action will do the following to the merging PR:

- Merge the PR if it’s up-to-date and all check pass
- Make it up-to-date if it isn't. Will merge when all check pass and remove it from merging status
- If it’s unable to make the PR up-to-date, or some required check fail, the PR will be removed from merging status
- When the PR is removed from merging status, it’ll look for a next PR in the queue, and process the same way.

### Limitation

- Only support required checks from CircleCI https://github.com/autifyhq/merge-queue-action/issues/24
- Only support base branch that has a required check https://github.com/autifyhq/merge-queue-action/issues/23

PRs welcome :)

## Releasing

1. Bump the version in `package.json`
2. Run `npm install && npm run all`
3. Update the version in code example in `README.md`
4. Commit and push to the `main` branch
5. Create a release in GitHub with the new version; e.g. `0.4.0` in `package.json`, the release should have a tag `v0.4.0`.
