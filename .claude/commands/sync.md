Sync the current feature branch with the latest main from origin.

Steps:
1. Run `git branch --show-current` to confirm the current branch.
2. If already on `main`, just run `git pull origin main` and report the result.
3. If on a feature branch:
   a. Check for uncommitted changes with `git status --short`. If any exist, stop and tell the user to commit or stash first.
   b. Run `git fetch origin main`.
   c. Run `git rebase origin/main` to replay feature commits on top of the latest main.
   d. If rebase succeeds cleanly, report how many commits were rebased and the new base.
   e. If rebase hits a conflict, list the conflicting files and tell the user to resolve them, then run `git rebase --continue`. Do not attempt to auto-resolve conflicts.
4. Never force-push unless the user explicitly asks after being told the rebase rewrote history.
