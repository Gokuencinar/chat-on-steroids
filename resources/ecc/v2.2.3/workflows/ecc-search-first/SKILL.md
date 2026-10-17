---
name: "ECC: Search first"
description: "Research existing implementations and dependencies before building new functionality."
---

Adapted from ECC v2.2.3 by Affaan Mustafa (MIT): https://github.com/affaan-m/ECC. This CoS adaptation uses only the tools available in the current conversation.

# Research before implementation

1. Describe the specific missing capability, its inputs, outputs, constraints and supported platforms.
2. Search the current repository and callers first. Then inspect installed dependencies, official documentation, package registries and established open-source alternatives where accessible.
3. Compare candidates on licensing, maintenance, dependency size, security, API fit, testability and integration cost. Confirm versions and licenses from sources.
4. Choose reuse, adaptation or a small custom implementation. Explain the choice in terms of observable requirements.
5. Implement and verify with the project's normal tools. Do not download or execute third-party installers without a reason and the applicable authorization.

If a search channel is unavailable, name the missing evidence and continue from verified local facts. A README claim is not proof that an API works in this environment.
