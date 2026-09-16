# Lautstark org defaults

What every Lautstark repository shares, kept in one place so that changing it
is one edit rather than eleven.

## `renovate-shared.json5`

The Renovate preset. A repository picks it up with one line in its own
`renovate.json5`:

```json5
{ extends: ["github>Lautstark/.github//renovate-shared.json5"] }
```

The `.json5` is spelled out on purpose. Renovate's `//path/to/file` syntax
implies a `.json` extension, and so does the shorter `owner/repo:name` form,
so either of those looks for a file that is not here and stops before doing
anything.

What it settles: updates arrive weekly, Monday before six, Europe/Berlin, as
at most three branches with one dashboard issue listing the rest. Since
2026-09-16 a branch that merges itself does so **without a pull request**:
Renovate pushes `renovate/<name>`, waits for the repository's tests on it, and
pushes the commit to `main` — which is why every repository's test workflow
runs on `renovate/**` and its deploy job checks for `main` by ref. Three
things merge themselves that way, each a minor or a patch: development
dependencies after three days on the registry, the toolchain (vite, vitest,
typescript, playwright) under its own name after the same three days, and the
family's own `@lautstark/*` packages — `github:` tags, followed through the
github-tags datasource — with no wait. Every major, every
other runtime dependency, GitHub Actions and lockfile maintenance are grouped
but wait for a person. Security advisories ignore the schedule and are never
automerged.

What it deliberately does **not** settle is anything true of one repository
only. Those rules live in that repository's `renovate.json5`: `onnxruntime-web`
where it is pinned, and `@lautstark/bildquelle` where it is consumed, which
stays a person's decision because what it changes is what may leave a METACOM
folder.

## `.github/workflows/commit-messages.yml`

The conventional-commit gate, as a reusable workflow. Eleven repositories
carried it verbatim until 2026-09-16 and three had already drifted; each now
calls this one:

```yaml
on:
  push:
    branches: [main, 'claude/**', 'renovate/**']
  pull_request:
jobs:
  subjects:
    uses: Lautstark/.github/.github/workflows/commit-messages.yml@main
```

The rule itself stays in each repository's `tools/check-commit-subject.sh`,
because the `commit-msg` hook there calls the same file; this workflow applies
it to every non-merge commit in a push and skips commits older than the file.

## `.github/workflows/release.yml`

The release train for the shared packages, as a reusable workflow. A package
calls it on every push to `main`:

```yaml
jobs:
  release:
    uses: Lautstark/.github/.github/workflows/release.yml@main
    with:
      gate: npm run typecheck && npm test && npm run build
    secrets: inherit
```

It runs the gate and hands over to semantic-release, which reads the commit
subjects since the last tag and either cuts a release — version, CHANGELOG,
tag, GitHub release — or does nothing. There is no registry: a git tag is the
release, consumers pin `github:Lautstark/<pkg>#vX.Y.Z` as they always have,
and Renovate moves the pin. Nothing needs an account or a secret.

Added 2026-09-16, when the packages stopped being tagged by hand.

## Renovate has to be installed for any of this to run

The preset is configuration, not a service. Renovate acts on these
repositories only once the GitHub App is installed on the organisation and
granted access to them — <https://github.com/apps/renovate>. Until then these
files are correct and inert.
