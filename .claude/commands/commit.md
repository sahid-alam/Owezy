Run a branch-aware git commit for this project.

Steps:
1. Run `git branch --show-current` to get the current branch name.
2. Run `git status --short` and `git diff --staged` to see what's staged. If nothing is staged, run `git diff` to see unstaged changes and ask the user which files to stage.
3. **Branch safety check:**
   - If the branch is `main`, warn the user: "You're about to commit directly to main. Feature work should go on a feature branch (e.g. feature/friends). Commit anyway?" Wait for confirmation before continuing.
   - If the branch is a feature branch (e.g. `feature/friends`), note it — the commit scope can be inferred from the branch name.
4. Draft a concise commit message:
   - First line: imperative mood, max 72 chars, no trailing period. Infer scope from branch name where natural (e.g. branch `feature/friends` → message might start with `add friends...` or `feat(friends): ...`).
   - Do NOT add a `Co-Authored-By` trailer. No exceptions.
   - If the change is non-trivial, add a short body paragraph after a blank line explaining the *why*.
5. Show the proposed commit message to the user and ask for approval or edits.
6. Once approved, stage any unstaged files the user confirmed and run `git commit -m "..."` using a HEREDOC to preserve formatting.
7. Report the commit hash and summary line.

Arguments (optional): $ARGUMENTS — pass a hint or partial message to seed the commit message draft.
