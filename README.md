# SnapBasket - Work in progress. 🚧

An exploration of durable orchestration for agentic AI workflows. Upload a photo of a handwritten grocery list and a Trigger.dev v4 workflow extracts the items, normalizes them, matches them to a (mock) commerce catalogue, validates them against user policy and pauses durably for human approval before finalizing a (mock) checkout.

The interesting layer is everything around the LLM - retries, idempotency, durable pauses, provider abstraction and a clear safety boundary between *the agent proposes* and *the user confirms*.