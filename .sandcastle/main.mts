// Sandcastle loop for this repo.
//
// Phase 1: plan open GitHub issues and determine which are unblocked.
// Phase 2: run Codex agents in parallel for each unblocked issue.
// Phase 3: merge the resulting branches and close the issues.

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const MAX_ITERATIONS = 10;
const cwd = ".";

const orchestratorEnvPath = path.resolve(".sandcastle/.env");

const readEnvValue = (key: string): string | undefined => {
  try {
    const content = readFileSync(orchestratorEnvPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const envKey = trimmed.slice(0, eqIndex).trim();
      if (envKey !== key) continue;
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        value.length >= 2 &&
        ((value[0] === '"' && value[value.length - 1] === '"') ||
          (value[0] === "'" && value[value.length - 1] === "'"))
      ) {
        value = value.slice(1, -1);
      }
      const normalizedValue = value.trim();
      return normalizedValue.length > 0 ? normalizedValue : undefined;
    }
  } catch {
    // No local env file yet.
  }
  return undefined;
};

const readConfiguredEnvValue = (key: string): string | undefined =>
  process.env[key]?.trim() || readEnvValue(key);

const ghToken = readConfiguredEnvValue("GH_TOKEN");
const codexHome = path.resolve(
  readConfiguredEnvValue("CODEX_HOME") ?? path.join(os.homedir(), ".codex"),
);

if (!statSync(codexHome, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error(
    `Codex auth directory not found at ${codexHome}. Run \`codex login --device-auth\` first or set CODEX_HOME to an existing Codex home.`,
  );
}

if (!ghToken) {
  throw new Error(
    `GH_TOKEN is missing. Set it in ${orchestratorEnvPath} or export it before running npm run sandcastle.`,
  );
}

const hooks = {
  sandbox: {
    onSandboxReady: [
      {
        command:
          "test -f package.json && npm install || echo 'no package.json yet, skipping install'",
      },
    ],
  },
};

const copyToWorktree: string[] = [];

const sandbox = docker({
  env: {
    GH_TOKEN: ghToken,
  },
  mounts: [
    {
      hostPath: codexHome,
      sandboxPath: "/home/agent/.codex",
    },
  ],
});

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  const plan = await sandcastle.run({
    cwd,
    hooks,
    sandbox,
    name: "planner",
    maxIterations: 1,
    agent: sandcastle.codex("gpt-5.3-codex", { effort: "xhigh" }),
    promptFile: "./.sandcastle/plan-prompt.md",
  });

  const planMatch = plan.stdout.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!planMatch) {
    throw new Error("Planning agent did not produce a <plan> tag.\n\n" + plan.stdout);
  }

  const { issues } = JSON.parse(planMatch[1]!) as {
    issues: { id: string; title: string; branch: string }[];
  };

  if (issues.length === 0) {
    console.log("No unblocked issues to work on. Exiting.");
    break;
  }

  console.log(`Planning complete. ${issues.length} issue(s) to work in parallel:`);
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  const settled = await Promise.allSettled(
    issues.map((issue) =>
      sandcastle.run({
        cwd,
        hooks,
        copyToWorktree,
        sandbox,
        branchStrategy: { type: "branch", branch: issue.branch },
        name: `implementer-${issue.id}`,
        maxIterations: 100,
        agent: sandcastle.codex("gpt-5.3-codex", { effort: "high" }),
        promptFile: "./.sandcastle/implement-prompt.md",
        promptArgs: {
          TASK_ID: issue.id,
          ISSUE_TITLE: issue.title,
          BRANCH: issue.branch,
        },
      }),
    ),
  );

  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      );
    }
  }

  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter(
      (
        entry,
      ): entry is {
        outcome: PromiseFulfilledResult<Awaited<ReturnType<typeof sandcastle.run>>>;
        issue: (typeof issues)[number];
      } => entry.outcome.status === "fulfilled",
    )
    .filter(
      ({ outcome }) => outcome.value.commits !== undefined && outcome.value.commits.length > 0,
    )
    .map(({ issue, outcome }) => ({
      issue,
      branch: issue.branch,
      commits: outcome.value.commits,
    }));

  if (completedIssues.length === 0) {
    console.log("No branches produced commits. Exiting.");
    break;
  }

  const mergeTargets = completedIssues.map((entry) => entry.branch);
  const issueSummaries = completedIssues.map((entry) => `${entry.issue.id}: ${entry.issue.title}`);
  const closeCommands = completedIssues.map((entry) => `gh issue close ${entry.issue.id} --comment "Implemented via Sandcastle."`);

  const merge = await sandcastle.run({
    cwd,
    hooks,
    sandbox,
    name: "merger",
    maxIterations: 100,
    agent: sandcastle.codex("gpt-5.3-codex", { effort: "high" }),
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      BRANCHES: mergeTargets.join("\n"),
      ISSUES: issueSummaries.join("\n"),
      CLOSE_COMMANDS: closeCommands.join("\n"),
    },
  });

  if (!merge.stdout.includes("<promise>COMPLETE</promise>")) {
    console.log(merge.stdout);
  }
}
