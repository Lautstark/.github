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
at most three pull requests with one dashboard issue listing the rest.
Development dependencies group together and are the only thing that merges
itself, after three days on the registry. Runtime dependencies, GitHub Actions
and every major are grouped but wait for a person. Security advisories ignore
the schedule and are never automerged.

What it deliberately does **not** settle is anything naming a particular
package. Those rules live in each repository's own `renovate.json5`, because a
rule about a dependency is only true where that dependency is. The two in use
today are the `github:`-pinned `@lautstark/*` packages and `onnxruntime-web`;
both are disabled where they appear, and both files say why at length.

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

It runs the gate, checks that the tarball `npm pack` would ship is complete
and prebuilt, and hands over to semantic-release, which reads the commit
subjects since the last tag and either cuts a release — version, CHANGELOG,
tag, npm publish, GitHub release — or does nothing. The one-time account
setup it needs (the `@lautstark` scope on npmjs.org, and either trusted
publishing or an `NPM_TOKEN` secret) is described at the head of the file and
in each package's `RELEASING.md`. Until that exists the workflow stops with a
notice and stays green.

Added 2026-09-16, when the packages moved from `github:` tags to npm.

## Renovate has to be installed for any of this to run

The preset is configuration, not a service. Renovate acts on these
repositories only once the GitHub App is installed on the organisation and
granted access to them — <https://github.com/apps/renovate>. Until then these
files are correct and inert.
