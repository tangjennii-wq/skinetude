#!/bin/bash
# .claude/git-sync-check.sh — fires automatically on SessionStart.
# Read-only sanity check. Detects the divergent-branch / lock-file
# states that caused the June 2026 rebase chaos. Output is injected
# into Claude's session context so it knows what state the repo is in
# before touching tracked files.

REPO="/Users/jennitang/Developer/TangSkin"
cd "$REPO" 2>/dev/null || { echo "[git-sync-check] Repo not at $REPO — skipping."; exit 0; }

issues=()

# ---- State 1: uncommitted local changes (Codex's in-flight work?) ----
modified_count=$(git status --short 2>/dev/null | grep -v '^??' | wc -l | tr -d ' ')
if [ "$modified_count" -gt 0 ]; then
  files=$(git status --short 2>/dev/null | grep -v '^??' | awk '{print $2}' | head -5 | tr '\n' ' ')
  issues+=("UNCOMMITTED ($modified_count files): $files")
fi

# ---- State 4: stale lock files ----
for lock in index.lock HEAD.lock ORIG_HEAD.lock refs/heads/main.lock; do
  if [ -f "$REPO/.git/$lock" ]; then
    issues+=("LOCK FILE: .git/$lock — rm it if no git op is running")
  fi
done

# ---- State 2 + 3: remote ahead / divergent ----
# Fetch with 4s timeout so offline sessions don't hang.
( git fetch origin --quiet 2>/dev/null ) &
fetch_pid=$!
( sleep 4 && kill -0 $fetch_pid 2>/dev/null && kill $fetch_pid 2>/dev/null ) &
killer_pid=$!
wait $fetch_pid 2>/dev/null
kill $killer_pid 2>/dev/null

behind=$(git log --oneline HEAD..origin/main 2>/dev/null | wc -l | tr -d ' ')
ahead=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l | tr -d ' ')
if [ "$behind" -gt 0 ] && [ "$ahead" -gt 0 ]; then
  issues+=("DIVERGENT BRANCH: $ahead local commit(s) not on remote, $behind remote commit(s) not local — manual rebase needed")
elif [ "$behind" -gt 0 ]; then
  recent=$(git log --oneline HEAD..origin/main 2>/dev/null | head -3 | tr '\n' '|')
  issues+=("REMOTE AHEAD by $behind: $recent — pull before editing")
fi

# ---- State 5: untracked load-bearing files (Codex new file?) ----
untracked=$(git ls-files --others --exclude-standard -- src/ index.jsx.source supabase/ 2>/dev/null | head -5 | tr '\n' ' ')
if [ -n "$untracked" ]; then
  issues+=("UNTRACKED in src/: $untracked")
fi

# ---- Report ----
if [ ${#issues[@]} -eq 0 ]; then
  echo "[git-sync-check] All five states clean. Safe to edit."
else
  echo "[git-sync-check] ⚠ DANGER STATES DETECTED — surface to Jenni before editing tracked files:"
  printf '  • %s\n' "${issues[@]}"
  echo "[git-sync-check] Invoke the git-sync-check subagent (.claude/agents/git-sync-check.md) for full diagnosis."
fi
