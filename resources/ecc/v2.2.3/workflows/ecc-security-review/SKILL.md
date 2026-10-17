---
name: "ECC: Agent security review"
description: "Audit agent prompts, tool configuration, secrets, permissions and shell hooks with concrete evidence."
---

Adapted from ECC v2.2.3 by Affaan Mustafa (MIT): https://github.com/affaan-m/ECC. This CoS adaptation uses only the tools available in the current conversation.

# Agent and repository security review

Review only files and systems within the approved scope. Identify the active instruction files, MCP/plugin configuration, generated scripts and tool permissions. Trace untrusted text that may reach a shell, URL, filesystem path or privileged tool. Check for hardcoded secrets without disclosing values, dangerous wildcard grants, silent failures, unaudited downloads and prompt-injection escalation paths.

For each verified problem, provide severity, file/line, a concrete exploit or failure path and the smallest safe mitigation. Prefer static review first. If a trusted AgentShield installation is already available, it may supplement the review; do not treat it as integrated into CoS or run a remote npx command automatically. Never make security-sensitive edits without checking what they break.

Finish by identifying what was inspected, what was skipped and whether any issue is confirmed or only suspected.
