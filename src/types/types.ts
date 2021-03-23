export interface WebhookPrData {
  node_id: string
  labels: { name: string }[]
  head: { ref: string }
  base: { ref: string }
  title: string
  number: number
}

export interface WebhookRepoData {
  node_id: string
  owner: { login: string }
  name: string
}
