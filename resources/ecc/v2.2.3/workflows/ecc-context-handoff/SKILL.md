---
name: "ECC: Context handoff"
description: "Preserve decisions, evidence and remaining work when moving a long CoS conversation to a new chat."
---

Adapted from ECC v2.2.3 by Affaan Mustafa (MIT): https://github.com/affaan-m/ECC. This CoS adaptation uses only the tools available in the current conversation.

# Strategic context handoff

At a meaningful milestone or when the conversation approaches its context limit, prepare a handoff containing: objective and user constraints; verified files/commits and test output; decisions with reasons; current worktree state; unresolved problems and the exact next action. Distinguish evidence from intentions.

Use CoS Compact & Resume when available so the durable local session and its ownership survive the provider-chat switch. Do not run a generic Claude Code /compact command or create unrelated browser conversations. Keep the handoff concise, precise, and sufficient for a fresh coding agent to continue without repeating completed work.
