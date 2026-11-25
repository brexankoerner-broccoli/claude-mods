# claude-mods

Mods for the Claude desktop app (Code tab). No company-specific information.

| Mod | What it does |
|---|---|
| **usage-bars** | A small band above the prompt box showing your 5-hour and 7-day plan usage (with reset clocks) and how full the context window is. Hover the Context chip to see token counts. Type `/usage-bars` to hide or show it. |
| **prompt-master** | Type a rough prompt, then press **✨ Prompt Master** above the prompt box. Claude rewrites it into a clearer prompt and puts it back in the box for you to review before sending. **Undo** restores your draft. You can also type `/prompt-master <rough prompt>`. |

## Install

This repo is private, so ask Brexan to add you as a collaborator first.

**1. Let Claude Code reach GitHub as you** (one time). In Terminal:

```bash
gh auth login
```

```bash
gh auth setup-git
```

**2. Add this repo and install the mods.** Replace `<owner>` with the account you were given access to (`brexankoerner-broccoli` or `Aspodacious`):

```bash
claude plugin marketplace add <owner>/claude-mods
```

```bash
claude plugin install usage-bars@brexan-mods
```

```bash
claude plugin install prompt-master@brexan-mods
```

Or, in a Claude Code session, just ask: *"Add the plugin marketplace <owner>/claude-mods and install usage-bars and prompt-master from it."*

**3. Start a new session.** The usage band and the Prompt Master button appear above the prompt box.

## Getting updates automatically

Auto-update is **off** by default for marketplaces outside Anthropic. Turn it on once:

- Run `/plugin`, open the **Marketplaces** tab, pick **brexan-mods**, and turn on auto-update, **or**
- ask Claude in a session: *"Turn on auto-update for the brexan-mods plugin marketplace."*

Claude Code then checks for changes about 10 minutes into a session, and new versions load in your next session. Step 1 above (`gh auth setup-git`) is what lets those background checks reach this private repo.

To update by hand instead:

```bash
claude plugin marketplace update brexan-mods
```

```bash
claude plugin update usage-bars@brexan-mods
```

```bash
claude plugin update prompt-master@brexan-mods
```

## Uninstall

```bash
claude plugin uninstall usage-bars@brexan-mods
```

```bash
claude plugin uninstall prompt-master@brexan-mods
```

## For the maintainer

The plugins have no `version` field on purpose: Claude Code then uses the git commit as the version, so every push reaches people with auto-update on. If you ever add a `version`, bump it on every change or nobody gets the update.

usage-bars is adapted from desktop-usage-strip (awesome-claude-code-mods, MIT).
