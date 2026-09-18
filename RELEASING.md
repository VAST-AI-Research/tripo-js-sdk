# Releasing

Publishing runs from `.github/workflows/publish.yml` using npm Trusted
Publishing. There is no `NPM_TOKEN` and no repository secret: npm authenticates
the workflow itself over OIDC.

## Cutting a release

```sh
npm version <major|minor|patch>   # updates package.json and creates the tag
git push origin main --tags
```

Pushing the `v*` tag triggers the workflow, which refuses to publish if the tag
does not match the `version` in `package.json`, runs the test suite, and then
publishes with build provenance attached.

Keep the `User-Agent` default in `src/http.js` in step with the version.

## One-time setup (already done)

On [npmjs.com](https://www.npmjs.com/package/@vastai/tripo-sdk/access) →
**Settings** → **Trusted Publisher** → **GitHub Actions**:

| Field | Value |
| --- | --- |
| Organization or user | `VAST-AI-Research` |
| Repository | `tripo-js-sdk` |
| Workflow filename | `publish.yml` |
| Environment | *(blank)* |
| Allowed actions | `npm publish` |

These fields are case-sensitive and the workflow filename must be the bare
filename, not a path. Renaming `publish.yml` breaks publishing until the entry
is updated to match.

Requires npm >= 11.5.1 and a GitHub-hosted runner; self-hosted runners cannot
use trusted publishing.
