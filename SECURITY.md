# Security

## Supported scope

This release is a single-user desktop / trusted-LAN tool. It has no login system, tenant isolation or GPU quotas. Anyone who can reach an unprotected deployed UI can use its relays, change its shared renderer address and submit work. Keep it behind an authenticated HTTPS gateway or VPN for remote access; do not publish its listening port to the internet. HTTP localhost is appropriate for local use. Use trusted HTTPS for LAN credentials and browser media/clipboard APIs.

The Python service binds to loopback and validates Host, request origin and a per-process submission token. Cross-site browser reads are rejected using Fetch Metadata; exact-origin checks and the submission token protect POST operations. Nginx in the LXC installer is a trusted-LAN gateway, not authentication. These checks do not protect against malicious local programs, authorized LAN users or a compromised browser/backend.

Only explicitly allowlisted assets are served. Directory listings, dotfiles, source server code, tests, generated outputs and symlinked assets are blocked. Finishing uploads use opaque identifiers outside the source tree. ComfyUI requests target the configured origin and allowlisted routes; redirects/environment proxies are disabled. AI relay targets are localhost/private IP addresses and supported API routes, without redirects. Connecting to private services is an intentional capability, so deployment access is a security boundary.

The media proxy rejects active HTML/SVG responses. FFmpeg/ffprobe inputs use container and protocol allowlists so uploaded playlists cannot retrieve network resources; the app-generated concat list is handled separately. A CSP, nosniff, frame blocking, no-referrer and no-store headers add browser protections. Direct local/LAN backend connections remain supported by CSP; it is not a substitute for safe DOM rendering or gateway access control.

## Sensitive data

- API keys entered in the dedicated connection field stay in browser memory and are omitted from saved profiles and connection exports. They are sent only to the selected AI endpoint through the relay.
- Imported workflows can contain arbitrary node inputs, including secrets. Do not embed credentials in workflow files; inspect them and exported backups before sharing.
- Browser projects and media are private to that browser origin, not encrypted vaults. Other users with access to the profile may read them.
- ComfyUI histories and model-generated metadata may retain submitted prompts, filenames and images under ComfyUI's own storage policy.
- Temporary files normally disappear at graceful server exit. OS crashes may leave temporary files behind. Keep the host account and temporary storage private.
- Upload limits do not constitute full disk/CPU/GPU quotas. Transcoding/AI jobs can be expensive; use trusted clients, free-disk monitoring and deployment resource limits.

Keep Python, browser, FFmpeg, ComfyUI, custom nodes and models current from trusted publishers. Custom nodes execute code on the backend; the studio cannot sandbox them.

## Reporting a vulnerability

Do not post API keys, private prompts/media, endpoints or exploit payloads containing real data in public issues. Once GitHub private vulnerability reporting is enabled, use **Security → Report a vulnerability**. If that option is absent, open a minimal public issue asking the maintainer for a private reporting channel, without disclosing the vulnerability details. No private disclosure service is currently guaranteed by this source package.
