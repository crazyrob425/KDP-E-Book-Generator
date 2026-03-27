# Copilot on GitHub Web — Permissions & Workflow Guide

This document explains why GitHub Copilot coding-agent sessions on the GitHub website may appear
to "block" write operations (commits, PR creation, file changes), and the exact steps to unblock them.

---

## Why Write Operations Are Sometimes Blocked

### 1. Confirmation dialogs ("Are you sure?")

GitHub Copilot's coding agent requires explicit confirmation before performing **destructive or
write operations** such as:

- Creating or updating a pull request
- Committing files to a branch
- Running code that modifies the repository

When the agent asks **"Are you sure?"** you must respond in the chat.  
Simply typing text in the *next* chat message is **not** the same as answering the confirmation
dialog — you must specifically reply to the inline dialog that appears within the agent response.

**How to confirm:**

1. Scroll to the agent's latest response in the chat.
2. Look for the yellow/orange confirmation panel labeled **"Are you sure?"** or similar.
3. Click **Confirm** (or type your confirmation reply directly to that message).

---

### 2. Repository permissions

For Copilot to create commits and PRs on a **public** repository:

| Requirement | How to verify |
|---|---|
| You are signed in to GitHub | Check top-right avatar |
| You have **Write** access to the repo | `Settings → Collaborators` (or you are the owner) |
| GitHub Copilot is enabled on your account | `Settings → Copilot` |
| The Copilot plan includes coding-agent features | Requires Copilot Pro or higher |

Even on a public repo, Copilot **cannot push** without your account having write access, because
it acts on your behalf using your OAuth token.

---

### 3. Copilot Workspace vs. Chat

There are two different Copilot surfaces on GitHub web:

| Surface | Can commit/PR? | How |
|---|---|---|
| **Copilot Chat** (sidebar/chat panel) | ❌ No — read-only suggestions | Copy code, paste manually |
| **Copilot Workspace / Coding Agent** | ✅ Yes — can open PRs | Must confirm agent action dialogs |

If you are in plain **Copilot Chat** (the sidebar), the agent cannot write to the repo regardless
of permissions.  To enable write operations, use the **Copilot coding agent** task feature, which
shows a task progress panel and confirmation dialogs.

---

### 4. Browser/network issues

If confirmation dialogs appear to "disappear" or not work:

- Disable browser extensions (ad-blockers, content-blockers) temporarily.
- Try a different browser (Chrome/Edge recommended for GitHub web).
- Clear site data and reload.
- Ensure you are not using a corporate proxy that intercepts WebSockets.

---

## Step-by-Step: Confirming a Copilot Coding Agent Action

1. **Start a task** — In a repository's Copilot chat, describe what you want done.
2. **Review the plan** — The agent shows a checklist of what it will do.
3. **Confirm** — When the **"Are you sure?"** dialog appears, click the confirmation button
   in the agent response (not just type a reply in a new message).
4. **Monitor progress** — A task panel shows which files are being changed.
5. **Review the PR** — Once the agent finishes, it opens a draft PR for your review.
6. **Merge** — Review diffs and merge when satisfied.

---

## Troubleshooting: "I confirmed but nothing happened"

| Symptom | Likely cause | Fix |
|---|---|---|
| Agent says "I can't write" | Wrong surface (Chat vs. Workspace) | Switch to coding-agent mode |
| Confirmation clicked, no PR created | Session timeout | Start a new agent session |
| PR created but empty | Agent hit a token/time limit | Re-trigger from the PR comments |
| "Permission denied" in agent log | Your account lacks write access | Add yourself as collaborator |

---

## Quick Checklist Before Starting a Copilot Coding Task

- [ ] Signed into GitHub as the repo owner or a collaborator with **Write** access
- [ ] Using **Copilot coding agent** (task mode), not just Copilot Chat
- [ ] Copilot Pro/Enterprise plan active
- [ ] No browser extensions blocking GitHub's UI components
- [ ] Ready to respond to **"Are you sure?"** confirmation dialogs as they appear
