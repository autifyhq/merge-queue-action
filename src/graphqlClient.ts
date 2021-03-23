import { graphql } from "@octokit/graphql"

export const graphqlClient = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
})
