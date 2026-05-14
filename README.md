# Trip-App

Family Trip Expense & List App prototype.

## Run

- `npm install`
- `npm start`

## Sandcastle

The repo includes a Codex-based Sandcastle loop at [`.sandcastle/main.mts`](./.sandcastle/main.mts).

Run it with:

- `npm run sandcastle`

Use `.sandcastle/.env.example` as the template for `GH_TOKEN`.
The Sandcastle runner uses Codex auth from the mounted `~/.codex` directory. `CODEX_HOME` is optional; leave it blank or unset to use your default Codex home. If the sandbox cannot see your Codex login, run `codex login --device-auth` on the host and rerun `npm run sandcastle`.
