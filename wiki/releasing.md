# Releasing TabTuck

Releases are built and published by [`.github/workflows/release.yml`](../.github/workflows/release.yml). A `vX.Y.Z` tag that matches `src/manifest.json` and `package.json` starts it.

## What the workflow does

1. Checks that the tag, `src/manifest.json`, and `package.json` have the same version.
2. Runs `make check`: linting, formatting, unit tests, the build, extension validation, and the package audit.
3. Scans the packaged files for secrets with Gitleaks.
4. Uploads `TabTuck-X.Y.Z.zip` and `SHA256SUMS` as a workflow artifact, with a build provenance attestation for tags.
5. Creates the GitHub release with those files.
6. Uploads the ZIP to the Chrome Web Store and submits it for review. This step is skipped until the store setup below is done.

Run the workflow by hand on a branch to build and audit a package without publishing anything. Run it by hand on an existing tag to retry a failed publication.

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
5. In GitHub, open **Settings → Environments**, create `chrome-web-store`, and add yourself as a required reviewer. Each store submission then waits for your approval.
6. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add these repository variables. None of them are secrets.

   | Variable                         | Value                                                                                        |
   | -------------------------------- | -------------------------------------------------------------------------------------------- |
   | `CWS_PUBLISHER_ID`               | Publisher ID from the dashboard **Settings** page                                            |
   | `CWS_EXTENSION_ID`               | Extension ID from the item page                                                              |
   | `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/tabtuck`    |
   | `GCP_SERVICE_ACCOUNT`            | Service account email                                                                        |
   | `CWS_PUBLISH_TYPE` (optional)    | `STAGED_PUBLISH` to hold an approved version until you publish it; default `DEFAULT_PUBLISH` |

## Every later release

1. Raise `version` in both `src/manifest.json` and `package.json`, and merge the change to `main`.
2. Tag the merged commit and push the tag:

   ```sh
   git tag v1.2.0
   git push origin v1.2.0
   ```

3. Approve the `chrome-web-store` deployment when GitHub asks.
4. Watch the review status in the Developer Dashboard. Listing text, screenshots, and privacy answers are changed only in the dashboard.
