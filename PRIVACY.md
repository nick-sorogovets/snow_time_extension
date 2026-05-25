---
title: Privacy Policy
permalink: /privacy/
layout: default
---

# Privacy Policy — SNOW Screenshot Extension

<!-- ──────────────────────────────────────────────────────────────────
     FILL IN BEFORE PUBLISHING
     • {{OWNER_NAME}}      — your name or legal entity
     • {{CONTACT_EMAIL}}   — public contact address
     • {{EFFECTIVE_DATE}}  — e.g. May 25, 2026
     • {{REPO_URL}}        — https://github.com/<user>/snow_time_extension
     • {{POLICY_URL}}      — public URL of this page (used in CWS form)
     ────────────────────────────────────────────────────────────────── -->

**Effective date:** {{EFFECTIVE_DATE}}

This Privacy Policy describes how the **SNOW Screenshot Extension**
(the “Extension”), maintained by **{{OWNER_NAME}}** (“we”, “us”), handles
information when you use it. The Extension is an open‑source Chrome
extension whose source code is available at
[{{REPO_URL}}]({{REPO_URL}}).

---

## 1. Single purpose

The single purpose of the Extension is:

> Capture a screenshot of the user’s currently active browser tab and
> upload it to a Google Drive folder chosen by the user.

The Extension does not perform any other primary function.

---

## 2. What information the Extension handles

The Extension processes a small, well‑defined set of data, all of which
stays under your control:

| Data                                  | Where it lives                                                                                  | Purpose                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Google Drive folder ID and name       | `chrome.storage.sync` (your Chrome profile)                                                     | Remember which Drive folder screenshots are uploaded to                 |
| Username prefix                       | `chrome.storage.sync`                                                                           | Build screenshot file names like `<username>_YYYY-MM-DD.png`            |
| Automation toggles                    | `chrome.storage.sync`                                                                           | Remember the auto‑capture / auto‑upload preferences                     |
| Language preference                   | `chrome.storage.sync`                                                                           | Remember your chosen UI language (EN, RU, IT, ES, PT, PL)               |
| Screenshot mode (visible / full page) | `chrome.storage.sync`                                                                           | Remember whether to capture viewport only or the loaded page height     |
| Google OAuth access token             | Cached in memory only, managed by `chrome.identity`                                             | Authenticate Drive API calls; never persisted to disk by the Extension  |
| Screenshot image (PNG)                | Generated on demand, sent directly to Google Drive over HTTPS                                   | The screenshot you asked the Extension to upload                        |
| The current page URL of the SNOW timesheet (`https://coxauto.service-now.com/time*`) | Read locally by a content script for the duration of the page visit | Detect the SNOW Submit button and the current week label |

The Extension **does not** collect, transmit or store:

- Any other browsing history, cookies, form input, or page content;
- Any analytics, telemetry, crash reports, advertising IDs, or device
  identifiers;
- Any data from websites other than the SNOW timesheet host
  (`coxauto.service-now.com`) for which `host_permissions` is declared;
- Personally identifiable information beyond what you voluntarily enter
  in Settings (your username prefix).

---

## 3. How information is used

- **Drive folder ID / name and username prefix** are stored locally so
  that the Extension can resume your settings on the next browser launch
  and via Chrome Sync across your own devices (if you have Chrome Sync
  enabled). This data never leaves Google’s infrastructure / your local
  machine.
- **Screenshots** are generated only when you explicitly press the
  *Capture* button or, if you enable it, when you press the *Submit*
  button on the SNOW timesheet page. In **full page** mode the Extension
  temporarily scrolls the active tab and stitches viewport captures
  locally in your browser; no page content is sent anywhere except the
  final PNG uploaded to your Drive. Screenshots are uploaded directly
  from your browser to your own Google Drive over HTTPS.
- **OAuth access tokens** are obtained through `chrome.identity` from
  Google’s servers and used solely as `Authorization: Bearer` headers on
  requests to `https://www.googleapis.com`. The Extension never transmits
  the token to any other endpoint.

---

## 4. Google API Services User Data Policy — Limited Use

The Extension’s use of information received from Google APIs adheres to
the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the **Limited Use** requirements.

Specifically:

1. The Extension **only requests the `https://www.googleapis.com/auth/drive.file`
   scope**, which gives access exclusively to files and folders that the
   user explicitly creates with, or selects through, this Extension. The
   Extension does **not** request access to the rest of your Google
   Drive.
2. We **do not transfer** Google user data to any third party except as
   necessary to provide or improve the user‑facing features of the
   Extension (which, in this case, means uploading the screenshot you
   asked us to upload, directly to your Google Drive).
3. We **do not use** Google user data for serving advertisements,
   profiling, or any purpose unrelated to the Extension’s single
   purpose.
4. **Humans do not read** Google user data, except (a) with your
   explicit consent, (b) for security purposes (e.g. investigating
   abuse), (c) to comply with applicable law, or (d) where the data has
   been aggregated and anonymised for the sole purpose of improving the
   Extension. None of these conditions are currently met by the
   Extension because it has no server‑side component.

---

## 5. No remote servers; no third parties

The Extension has **no backend of its own**. All communication is
between:

- your browser, and
- Google APIs (`https://www.googleapis.com`, `https://accounts.google.com`,
  `https://apis.google.com` — the last one only on the hosted Picker page
  described below).

### Hosted Picker page (GitHub Pages)

To let you pick an **existing** Google Drive folder under the
`drive.file` scope, the Extension opens a static helper page hosted at:

`https://nick-sorogovets.github.io/snow_time_extension/picker/`

That page:

- is **plain static HTML/JS** served from the open-source repository on
  GitHub Pages — no server-side code, no database, no analytics;
- loads Google’s Picker library from `https://apis.google.com`;
- requests an OAuth access token from the Extension via
  `chrome.runtime.sendMessage` (the token is **never** placed in the URL);
- sends back only the chosen folder `{ id, name }` to the Extension;
- does **not** persist any user data after the tab closes.

Communication is restricted by the Extension manifest field
`externally_connectable` to URLs under
`https://nick-sorogovets.github.io/snow_time_extension/*`. The Extension
background worker additionally verifies `sender.url` before handling
messages.

No analytics, tracking, error reporting, or other third‑party services
are embedded in the Extension.

---

## 6. Data retention and deletion

- **Local settings** persist in `chrome.storage.sync` until you remove
  the Extension or clear its storage. Removing the Extension via
  `chrome://extensions` deletes all of its locally stored settings.
- **OAuth access tokens** can be revoked at any time at
  <https://myaccount.google.com/permissions>; revoking access stops the
  Extension from communicating with Google Drive on your behalf.
- **Screenshots** are stored only in *your own* Google Drive. Deleting a
  file there deletes it permanently (subject to your Drive trash
  policy). The Extension cannot retrieve the file once it has been
  uploaded; it only stores the file ID returned by Drive long enough to
  display a one‑click *Open in Drive* link.

If you would like a written confirmation that no further data exists on
our side, contact us at
[{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}). We will reply within 30
days.

---

## 7. Permissions and why they are requested

For full transparency, here are all the Chrome permissions the Extension
declares in its manifest, and why:

| Permission                                  | Why it is needed                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `storage`                                   | Remember your settings (Drive folder, username prefix, automation toggles).   |
| `identity`                                  | Get an OAuth token to upload screenshots to your Google Drive.                |
| `activeTab`                                 | Capture a screenshot of the currently active tab when *you* click *Capture*.  |
| `notifications`                             | Tell you when a background upload succeeds or fails.                          |
| host: `https://coxauto.service-now.com/time*` | Detect the SNOW *Submit* button so the auto‑upload feature can react to it. |

The Extension does **not** request or use any other host permissions or
sensitive APIs.

---

## 8. Children’s privacy

The Extension is not directed at children under 13. It does not
knowingly collect personal information from children. If you believe a
child has used the Extension and provided personal information, please
contact us and we will delete the data.

---

## 9. Changes to this policy

We may update this Privacy Policy from time to time. Material changes
will be reflected by updating the **Effective date** at the top of this
document and, where appropriate, by an in‑Extension notification on the
next update. The current version is always available at
[{{POLICY_URL}}]({{POLICY_URL}}). Past versions are tracked in the
git history of [{{REPO_URL}}]({{REPO_URL}}).

---

## 10. Contact

Questions, requests, and security reports can be sent to:

**{{OWNER_NAME}}**
[{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})
[{{REPO_URL}}]({{REPO_URL}})
