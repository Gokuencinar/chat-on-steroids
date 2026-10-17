# ECC-inspired static project security audit

CoS can optionally review one **explicitly selected, approved local project directory** for a small set of security patterns. The scanner performs no commands, changes, downloads, background observation, code execution or network requests. It cannot certify a project as safe.

## Main-process integration

Import **auditEccProjectSecurity(projectRoot: string): Promise<EccSecurityAudit>** from src/main/ecc-security.ts. IPC must obtain the project root from a user-selected, existing local project; the scanner also accepts the canonical CoS virtual path. It reads current approved roots and effective read permission directly from CoS config; the caller cannot supply extra roots. Read-only mode permits the audit; disabled read permission refuses it.

The contract in src/shared/ecc-security.ts returns **project**, **findings** (severity, rule, relative path, one-based line, fixed explanation), **filesScanned**, **bytesScanned**, **partial**, **skipped**, and **limits**. Results never contain source excerpts, matched strings, credential values, or raw filesystem errors. A partial result means coverage was incomplete and must never be presented as a clean security verdict. IPC and renderer wiring are intentionally owned by the integrating developer.

## Scan coverage and limits

Root-level targets: AGENTS.md, CLAUDE.md, .cursorrules, .mcp.json, package.json, .claude/settings.json, .claude/settings.local.json, .codex/config.toml and .github/copilot-instructions.md. A single immediate level is considered inside .github/workflows (YAML), .cursor/rules (MDC), .husky, .githooks, .git/hooks (non-sample) and .claude/hooks (common executable-script extensions). There is no recursive source-code walk, environment-file probing, or scanning of sibling projects.

Hard bounds: at most **80 files**, **1 MiB total**, **64 KiB per file**, **2,000 lines per file**, **128 directory entries per discovered folder** and **60 findings**. Symlink/junction redirects, out-of-project paths, inaccessible and oversized files, binary data and invalid UTF-8 are omitted. Live permission/project identity is rechecked as work proceeds. Files omitted due to safety or budgets increment the skipped count and mark the result partial.

Conservative rules detect explicit permission wildcards (e.g. broad Bash tool grants or workflow write-all), literal credential-looking configuration assignments, PEM private-key boundaries, downloaded code piped directly to a shell from runnable hooks/scripts/workflows, TLS validation disabled, and imperative instruction-file overrides. Findings use fixed descriptions; no matched value is ever returned. Instruction overrides are **low-severity prompts for human review**, not proof of prompt injection.

Ordinary scoped permissions, environment-variable references, CI secret references and quoted explanatory examples should not trigger findings. The scan does not assess whether credentials are valid, evaluate CI execution context, detect every possible unsafe command, or replace a comprehensive code/security review. A result with zero findings only means none of these patterns was observed within the listed bounded files.
