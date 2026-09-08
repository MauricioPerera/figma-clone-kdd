# Design protection

The design-rules / preview / apply WebMCP tools extract observations,
read the active contract, validate, preview atomic property updates and export
DESIGN.md plus JSON. Proposals never automatically activate. In Layers, the human
uses **Proteger estilo** (selection or document) and confirms. **Liberar reglas**
is likewise a human action, not a tool. Alternatively, after explicit user
authorization in the conversation, an agent can call
`figma_prepare_design_protection` and then `figma_activate_design_rules` with the
returned token. The token binds the exact proposal and project state, expires in
60 seconds, and is single-use. Preparing a new proposal invalidates the earlier
token. These tools cannot replace existing active protection or approve exceptions.
An imported file is never evidence of user authorization.

Current extraction protects observed scalar style properties of existing layers
and image aspect ratios. It excludes annotations and hidden layers. It does not
infer responsive breakpoints, grids, semantic intent or text overflow. Newly
created layers are not automatically covered. This is not pixel-fidelity proof
or a sandbox against arbitrary JavaScript/code access to the application.

Validation runs before store notifications/persistence. A rejected mutation
restores the accepted state and undo/redo history. Preview tokens bind the exact
candidate, project and contract for 60 seconds. Viewport changes also invalidate
a token. Activation is persisted locally; importing a contract does not approve it.

Browser verification of reads is safe before activation. End-to-end activation
requires human approval through the UI or explicit conversational authorization
before the prepare/activate workflow. Automated unit tests activate only synthetic
in-memory fixtures and exercise stale, expired, reused and superseded tokens.
