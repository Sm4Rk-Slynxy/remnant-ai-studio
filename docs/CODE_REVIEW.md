# Public-release code review

Reviewed: 2026-10-27. Scope: the separate clean release tree, not private production data or the running deployment. This is a manual code/security review with targeted automated regressions, not a penetration-test certification or a guarantee that no vulnerabilities remain. CodeRabbit CLI was installed but signed out, so no external CodeRabbit review was performed and no code was transmitted to it.

## Critical / high-priority findings — addressed in the release

| Finding | Impact | Resolution and evidence |
| --- | --- | --- |
| Generic static serving exposed files under the source root, including private projects, renders and future Git metadata. Inherited HEAD bypassed GET's checks. | Anyone with access to the service could retrieve unintended files. | Explicit public-asset allowlist, no directory listings, validated HEAD, encoded-path and symlink rejection. Security tests cover GET/HEAD for private files, Git metadata, traversal, symlinks and unsupported API HEAD. |
| Imported collection IDs were interpolated into inline JavaScript; saved workflow/model/seed fields were rendered as raw HTML. | A shared prompt-collection import could execute code in the studio origin and access projects or submit requests. | DOM event callbacks replace inline handlers. Dynamic metadata is escaped. A real-browser regression uses hostile IDs/HTML, checks that no active markup is created and verifies session-key exclusion. |
| Private production files and a copied installed-model inventory were mixed into the application directory. | Accidental public upload could disclose private prompts, media, network details and user metadata. | Clean allowlisted release created separately, with generic defaults and representative synthetic test schemas. Private material excluded; ignore rules, a tracked-file scanner and a clean-history packaging procedure added. |

## Warnings — addressed or bounded

| Finding | Resolution / boundary |
| --- | --- |
| ComfyUI relay followed redirects and inherited environment proxy configuration. | Fixed upstream origin/routes retained; redirects and environment proxies disabled. Regression proves redirects do not reach their target. |
| A backend `/view` response could return active HTML/SVG in the studio origin. | Media MIME allowlist rejects active content. Other relay responses are served as JSON with nosniff. Regression covers an HTML response. |
| Read endpoints lacked browser Fetch Metadata checks and complete cache/security headers. | Cross-site/same-site embedding rejected; no-store, CSP, nosniff, no-referrer and frame blocking added. Host/origin/token checks retained. |
| Untrusted media could select playlist demuxers and retrieve network resources during probing/transcoding. | Added input format/protocol allowlists to uploaded-media paths; app-generated concat remains separate. A regression checks HLS input is rejected without contacting a local target. |
| Malformed Content-Length could leave the error handler with an undefined route. | Route initialized before body parsing; a malformed-length request now returns a bounded JSON error. Chunked POST bodies rejected; upload read timeouts added. |
| Original integration workflows/catalogs had no established redistribution grant. | Excluded from the public tree. MIT applies to original code only. Optional local installation and wrapper limitations documented in THIRD_PARTY_NOTICES.md and workflows/README.md. |
| The original H3 prompt guide's provenance was unconfirmed. | Replaced with an original guide that preserves the application's six-section contract; tests updated to validate the public guide. |
| Deployment examples embedded private hosts and paths; nginx timeout did not cover the app's maximum AI timeout. | Generic examples/local defaults supplied; nginx timeout aligned to the supported 120-minute maximum. Installer avoids copying common private/generated files and private workflow installations. |

## Validation performed

- **117 JavaScript unit tests passed**, covering planning, continuity, workflows, metadata, credentials, render-quality wiring and joining.
- **15 Python integration/security tests passed**, including real FFmpeg output, AI/ComfyUI relay boundaries, static-file isolation, cross-site reads and HEAD handling.
- **15 Chromium browser scenarios passed**, including hostile collection input, project persistence/import/export, character and photoshoot adapters, H3 prompt refinement, opening text-to-video, clip-quality overrides, ending-frame extraction, stop/resume and unsupported vision handling.
- The joiner test performs actual upload, reorder, trim, preview, download and muted export. It inspects frame count, output dimensions/audio and the first rendered pixel to verify order.
- Sequence tests use a simulated renderer but real media extraction/transcoding and final MP4 assembly. They verify the next prompt receives the actual extracted frame.
- Four screenshots generated in a fresh browser profile with a fictional story and original programmatic illustrations; all inspected visually. No private browser profile, song or original render used.
- Locked Playwright development installation verified with `npm ci --ignore-scripts`; npm audit reported zero known vulnerabilities in the three audited dependency entries at review time. This does not assess Python/FFmpeg/OS packages.
- Python/shell/JavaScript syntax checked. Public-file scanner checks the exact tracked tree for blocked paths, private-network/path patterns, common credential formats, unexpected binaries and workflow credential fields, without printing candidate secret values.

## Practical limits and follow-up

- No real H3/Krea GPU render was queued during this release review. Synthetic schemas are interface tests, not proof of compatibility with every installed custom-node version or model.
- This is a single-user local/trusted-LAN tool without authentication, user isolation or comprehensive resource quotas. Its relays intentionally reach private services. Internet-facing operation requires an authenticated HTTPS gateway/VPN and restricted backend access; the supplied nginx configuration alone provides no authentication.
- Arbitrary imported workflows can embed credentials or call additional services on ComfyUI. The dedicated API-key field is session-only, but imported workflow contents/prompts are not a secret vault and can appear in backups.
- Disk limits are not complete generated-output quotas; expensive media/AI requests remain a trusted-user capability. Monitor temporary storage and keep runtime dependencies patched.
- Fresh-clone Proxmox installation, real GPU/model validation, GitHub CI execution and platform security settings should be checked after repository creation. This preparation run validates the local code paths; it does not claim those remote actions have occurred.
