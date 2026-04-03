# Copilot Coding Agent – Workflow & Permissions Guide

This document explains how the GitHub Copilot coding agent is used in this repository, what permissions are required, how to resolve write-access blockers, and how to confirm any access prompts.

---

## 1. Why Write Operations May Be Blocked

The Copilot coding agent runs inside a sandboxed environment with read/write access to your repository limited by the GitHub App's installation permissions. The most common reasons writes (commits, branch pushes, PR creation) fail are:

| Cause | Symptom | Fix |
|---|---|---|
| **GitHub App not installed** | "Resource not accessible by integration" error | Install the GitHub Copilot app on the repo (see §3) |
| **Missing Contents `write` permission** | Push rejected / 403 from API | Grant `Contents: Read & Write` in the app's permission settings |
| **Missing Pull Requests `write` permission** | PR creation fails | Grant `Pull requests: Read & Write` |
| **Repository is private and app scope is org-only** | 404 or 401 | Extend app installation to include this individual repository |
| **Branch protection rule blocks force-push** | `GH006: Protected branch update failed` | Ensure the agent's branch (`copilot/…`) is not covered by a restrictive branch protection rule |
| **Token expiry / re-auth required** | "Bad credentials" | Re-trigger the agent session from the Copilot chat; tokens are refreshed on each session start |

---

## 2. Required Permissions

The following GitHub App / OAuth permissions must be granted for the agent to operate fully:

### Repository permissions
| Permission | Level | Purpose |
|---|---|---|
| **Contents** | Read & Write | Read source files; commit and push changes |
| **Pull requests** | Read & Write | Open, update, and comment on PRs |
| **Workflows** | Read | Inspect CI workflow runs and job logs |
| **Issues** | Read | Read issue context used as task instructions |
| **Metadata** | Read | Repository metadata (always required) |

### Account / organization permissions
| Permission | Level | Purpose |
|---|---|---|
| **Email addresses** | Read | Identify the user for commit authorship (optional) |

> **Minimum viable set:** `Contents: Read & Write` + `Pull requests: Read & Write` + `Metadata: Read`.

---

## 3. How to Install / Grant Access

1. Navigate to **Settings → GitHub Apps** in your GitHub account (or organization).
2. Find **GitHub Copilot** (or the specific coding agent app).
3. Click **Configure** next to the app.
4. Under **Repository access**, choose *Only select repositories* and add `KDP-E-Book-Generator`.
5. Under **Permissions**, verify the levels listed in §2 are granted; upgrade any that show *Read only*.
6. Click **Save**.

If you are using a **GitHub organization**, an organization owner must approve the app installation.

---

## 4. How to Run the Agent

### From a GitHub Issue
1. Open an issue describing the task.
2. Leave a comment starting with `@copilot` followed by your instructions (e.g., `@copilot Implement token-efficiency improvements as discussed`).
3. The agent will create a new branch `copilot/<slug>` and open a PR when the work is ready.

### From a Pull Request
1. Open or navigate to an existing PR.
2. Leave a review comment or PR comment beginning with `@copilot`.
3. The agent will push follow-up commits to the PR's branch.

### From Copilot Chat (VS Code / GitHub.com)
1. Open Copilot Chat.
2. Select the **"Ask Copilot"** or **"Copilot Workspace"** entry point.
3. Type your request; Copilot will confirm the intended changes before applying them.

---

## 5. Confirming Access Prompts

When the agent first attempts a write operation you may see a browser or in-editor prompt similar to:

> *"GitHub Copilot is requesting permission to write to your repository. Allow?"*

**Steps to confirm:**
1. Click **Allow** (or **Authorize**) in the prompt dialog.
2. If using the GitHub web interface, you may be redirected to a GitHub OAuth consent screen listing the permissions in §2 — review them and click **Authorize**.
3. If you see a CAPTCHA, complete it and re-submit.
4. For organization-owned repositories, a second prompt may appear asking an **organization owner** to approve — share the approval link with them.

Once confirmed, the session continues and subsequent writes in the same session do not require re-approval.

---

## 6. Verifying Write Access is Working

After granting permissions, verify the agent can write by checking:

```bash
# From any terminal with your PAT exported as GITHUB_TOKEN:
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/crazyrob425/KDP-E-Book-Generator \
  | jq '.permissions'
# Expected output includes: "push": true, "pull": true
```

Or within GitHub:  
**Settings → Integrations → GitHub Apps → Copilot → Repository access** → confirm `KDP-E-Book-Generator` is listed.

---

## 7. Common Commands Reference

| Task | Command / Action |
|---|---|
| Trigger the agent on an issue | Comment `@copilot <instructions>` on the issue |
| Re-trigger after permission grant | Edit or re-post your `@copilot` comment |
| Check CI status for the agent's PR | `gh run list --branch copilot/<slug>` |
| View agent's commit history | `git log origin/copilot/<slug> --oneline` |
| Manually push a fix to the agent's branch | `git push origin HEAD:copilot/<slug>` |

---

## 8. Environment Variables Required

The application itself needs the following environment variables set (not needed by the agent itself):

| Variable | Description |
|---|---|
| `VITE_GOOGLE_API_KEY` | Google Gemini API key for AI generation |
| `KDP_EMAIL` | Amazon KDP account email (used by automation worker) |
| `KDP_PASSWORD` | Amazon KDP account password (used by automation worker) |

Create a `.env` file in the repository root (it is `.gitignore`d):

```
VITE_GOOGLE_API_KEY=your_key_here
KDP_EMAIL=your_kdp_email
KDP_PASSWORD=your_kdp_password
```

---

## 9. Troubleshooting

**Agent says "I cannot push" or "write access denied"**  
→ Follow §3 to grant repository write permissions.

**Agent creates a branch but no PR appears**  
→ Ensure `Pull requests: Read & Write` permission is granted (§2).

**PR is opened but CI fails immediately**  
→ Check that `.env` secrets are configured as repository secrets in **Settings → Secrets and variables → Actions** if CI uses them.

**Agent loops without making progress**  
→ Check the conversation for a pending access/consent prompt and approve it (§5).

**"Protected branch" error on push**  
→ Either target a non-protected branch or add an exception for the Copilot app in **Settings → Branches → Branch protection rules**.
