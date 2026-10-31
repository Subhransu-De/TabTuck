# Releasing TabTuck

Releases are built and published by [`.github/workflows/release.yml`](../.github/workflows/release.yml). Start it by hand on `main` from **Actions → Release → Run workflow**.

- **Version:** leave it empty to release the next patch version (1.1.0 becomes 1.1.1), or enter a higher version such as `1.2.0`.
- **Dry run:** builds and audits the package on any branch without committing, tagging or publishing.

## Changelog

Each pull request with a user-visible change adds an entry under `## Unreleased` in [`CHANGELOG.md`](../CHANGELOG.md), grouped under `### Added`, `### Changed`, `### Fixed` or `### Removed`. A release moves those entries into a `## [X.Y.Z] - YYYY-MM-DD` section, and that section becomes the GitHub release notes. A release with an empty Unreleased section fails before anything is built.

## What the workflow does

1. **Build and audit package.** Picks the version and requires a passing Checks run on the `main` commit. Moves the Unreleased entries into the new version's section, then runs `make check` with the new version and changelog: linting, formatting, unit tests, the build, extension validation, and the package audit. Scans the packaged files for secrets with Gitleaks and keeps `TabTuck-X.Y.Z.zip`, `SHA256SUMS` and the release notes as workflow artifacts, with a build provenance attestation. The attestation records the `main` commit the release started from, because the release commit is created after the build.
2. **Tag and publish GitHub release.** Commits the version and changelog to `main` as `chore: release vX.Y.Z` by `github-actions[bot]`, tags the commit `vX.Y.Z`, and pushes both together. The push fails if `main` moved while the package was building, so the release always matches the audited package. Then creates the GitHub release with the package files and the changelog section as notes.
3. **Submit to Chrome Web Store.** Waits for approval on the `chrome-web-store` environment, then uploads the ZIP and submits it for review. This job holds the store secrets and cannot write to the repository. It skips with a notice if a store secret is missing.

## Retrying

If a later step fails, open the run and choose **Re-run failed jobs**. To retry an older release, run the workflow on its `vX.Y.Z` tag instead of `main`: it rebuilds from the tag, leaves an existing GitHub release unchanged, and skips the store upload if that version is already submitted.

## Package audit

`make audit-package` (also part of `make check`) reads `dist/tabtuck.zip` and fails when:

- A file is missing or not in the allowlist in `scripts/package-files.ts`, such as a source map or a stray development file.
- A file contains a local path (`C:\Users\…`, `/home/…`, `/Users/…`), an email address, a private key, a source map reference, or the building machine's user name, host name, or home directory.
- An icon contains PNG text or EXIF metadata.
- The ZIP has comments, extra fields (which can store file owners), encrypted or unsafe entries, or a checksum mismatch.
- The manifest is not Manifest V3, sets `key` or `update_url`, or has a different version.

## First release (manual, once)

The Chrome Web Store API cannot create an item, so the first version is uploaded by hand.

1. Build the package with `make check`, or run the Release workflow by hand on `main` and download the `tabtuck-package` artifact.
2. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), choose **Items → New item** and upload the ZIP.
3. Fill in the **Store listing**, **Privacy**, and **Distribution** tabs with the text in [`store/listing.md`](../store/listing.md), then submit for review.
4. Copy the extension ID from the item page and the publisher ID from **Settings**.

## Automated store publishing (once)

Google requires 2-step verification on the publisher's Google account for API publishing.

1. In a Google Cloud project, enable the **Chrome Web Store API** and the **IAM Service Account Credentials API**.
2. Create a service account with no project roles.
3. Create a Workload Identity Pool with a GitHub OIDC provider limited to this repository:

   ```sh
   gcloud iam workload-identity-pools create github --location=global
   gcloud iam workload-identity-pools providers create-oidc tabtuck \
     --location=global --workload-identity-pool=github \
     --issuer-uri=https://token.actions.githubusercontent.com \
     --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository \
     --attribute-condition="assertion.repository == 'Subhransu-De/TabTuck'"
   gcloud iam service-accounts add-iam-policy-binding SERVICE_ACCOUNT_EMAIL \
     --role=roles/iam.workloadIdentityUser \
     --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/Subhransu-De/TabTuck"
   ```

4. In the Developer Dashboard, open **Settings → Service account** and add the service account email.
5. In GitHub, open **Settings → Environments**, create `chrome-web-store`, add yourself as a required reviewer, and limit deployments to the `main` branch and `v*` tags (for retries). Each store submission then waits for your approval.
6. In the `chrome-web-store` environment, add these **environment secrets**. Most are not credentials, but as environment secrets only the approved store job can read them and the logs of this public repository mask them. Do not add them as repository variables, which anyone can read in the logs.

   | Secret                           | Value                                                                                        |
   | -------------------------------- | -------------------------------------------------------------------------------------------- |
   | `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/tabtuck`    |
   | `GCP_SERVICE_ACCOUNT`            | Service account email                                                                        |
   | `CWS_PUBLISHER_ID`               | Publisher ID from the dashboard **Settings** page                                            |
   | `CWS_EXTENSION_ID`               | Extension ID from the item page                                                              |
   | `CWS_PUBLISH_TYPE` (optional)    | `STAGED_PUBLISH` to hold an approved version until you publish it; default `DEFAULT_PUBLISH` |

## Every later release

1. Merge the changes for the release to `main`, each with its `CHANGELOG.md` entry. Do not change the version by hand.
2. Wait for Checks to pass on `main`, then open **Actions → Release → Run workflow**, choose `main`, and leave the version empty for a patch release or enter a higher version.
3. Approve the `chrome-web-store` deployment when GitHub asks.
4. Watch the review status in the Developer Dashboard. Listing text, screenshots, and privacy answers are changed only in the dashboard.

The release commit is pushed by `github-actions[bot]`, so pull `main` before starting new work.
