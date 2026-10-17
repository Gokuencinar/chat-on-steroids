---
name: "ECC: Parallel agent review"
description: "Delegate bounded independent reviews to CoS workers and reconcile their evidence before completion."
---

Adapted from ECC v2.2.3 by Affaan Mustafa (MIT): https://github.com/affaan-m/ECC. This CoS adaptation uses only the tools available in the current conversation.

# Parallel agent review

1. Split independent research, tests or review into tasks with explicit files, constraints and finish criteria. Keep only one owner for each edited file.
2. Check whether CoS agents are enabled. Reuse sleeping workers when possible; never invent their identities or spawn beyond the available capacity.
3. Send the exact task context and file ownership through agents. Do your own independent implementation while workers run.
4. Read actual worker reports and inspect resulting changes or tests yourself before accepting conclusions. Resolve conflicts in the main worktree deliberately.
5. Report confirmed results and anything that remains pending. A worker saying it is done does not prove a merge, test result or successful delivery.

Use update_plan for meaningful multi-step coordination. Follow the active CoS instructions for plan, worktree and agent lifecycle details.
