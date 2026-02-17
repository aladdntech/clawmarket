# Atlas — ClawMarket CEO Agent Configuration

## Agent Setup for OpenClaw

Atlas runs as an isolated session agent spawned for strategic and operational tasks.

### Spawning Atlas

Atlas is invoked via `sessions_spawn` with a specific task. He reads his charter (CEO_AGENT.md), 
assesses the current state, and executes.

### Example Invocations:

```
# Weekly strategic review
sessions_spawn(
  label: "atlas-weekly",
  model: "codex",
  task: "You are Atlas, CEO of ClawMarket. Read /Users/isra/.openclaw/workspaceYes/archive/clawmarket-simple/CEO_AGENT.md for your full charter. Perform a weekly strategic review: assess current state, identify top 3 priorities, and create an action plan. Write your report to memory/atlas/weekly-{date}.md"
)

# Provider recruitment campaign  
sessions_spawn(
  label: "atlas-recruit",
  model: "codex",
  task: "You are Atlas, CEO of ClawMarket. Read your charter at CEO_AGENT.md. Your task: design and execute a provider recruitment strategy. Research AI service providers, draft outreach messages, and create onboarding materials. Output to docs/provider-recruitment/"
)

# Dispute resolution
sessions_spawn(
  label: "atlas-dispute",
  task: "You are Atlas, CEO of ClawMarket. Read your charter. Resolve dispute #XYZ: [details]. Follow the ethics guidelines. Document your decision in memory/atlas/disputes/"
)
```

### Atlas's Tools
When spawned, Atlas has access to:
- File read/write (for reports, strategies, configs)
- Web search (for market research, competitor analysis)
- Web fetch (for analyzing competitor platforms)
- exec (for running scripts, checking platform status)
- message (for sending communications via WhatsApp/Telegram)

### Atlas's Memory Structure
```
memory/atlas/
├── daily-YYYY-MM-DD.md      # Daily operational notes
├── weekly-YYYY-MM-DD.md     # Weekly strategic reports
├── disputes/                 # Dispute resolution records
├── recruitment/              # Provider recruitment tracking
└── analytics/                # Revenue and growth analytics
```
