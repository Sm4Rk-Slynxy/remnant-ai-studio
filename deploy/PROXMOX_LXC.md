# Install Remn@nt AI Studio on Proxmox

Use a dedicated **unprivileged Debian/Ubuntu LXC with systemd**, not the Proxmox host. The container runs Python, nginx and FFmpeg; ComfyUI and the text AI run on your existing GPU machine. GPU passthrough is unnecessary for the studio container.

Suggested starting resources: 4 vCPU, 4 GB RAM and 40 GB disk. These are studio/finishing resources, not model-memory requirements. Allow extra disk for media. Use DHCP with a reservation or a properly configured static address on your trusted LAN.

## Install

Transfer a clean clone/archive of this repository into the container. Do not package the private development folder or its media. Export browser project backups and download finished videos separately before moving addresses.

Inside the dedicated container, as root, from this repository directory:

```bash
# Replace COMFY_HOST with your renderer's LAN IP/hostname.
COMFY_URL=http://COMFY_HOST:8188 bash deploy/install.sh 8080
```

The installer uses apt to install Python 3, FFmpeg, nginx, rsync and curl. It copies public app assets into `/opt/comfyui-film-studio`, creates an unprivileged service user and systemd service, and forwards nginx traffic to Python on loopback port 8099. It does not install ComfyUI, custom nodes, model weights or optional private workflows.

An initial `http://CONTAINER_IP:8080` smoke test is sufficient to check loading. Use trusted **HTTPS** for normal LAN work: clipboard/media APIs may be restricted over LAN HTTP. Keep the container and GPU servers on a trusted LAN; this installer adds no user accounts or authentication to the app.

## HTTPS and access control

Put an authenticated HTTPS reverse proxy or VPN in front of the studio for remote access. Use a trusted certificate and exact browser origin. With an existing TLS gateway:

```bash
COMFY_URL=http://COMFY_HOST:8188 FRONTEND_ORIGIN=https://studio.example.com bash deploy/install.sh 8080
```

Configure the TLS proxy to forward to `http://CONTAINER_IP:8080`, preserving Origin and Fetch Metadata headers. Match the configured origin exactly, including a non-default port. Permit 500 MB request bodies and up to 7200-second AI read timeouts at each proxy hop. Restrict direct access to the container port so users cannot bypass gateway authentication. Do not expose ComfyUI or this studio directly to the internet.

Open the configured URL, then set the text API address/model/key in **AI connections** and verify ComfyUI in its tab. The app remembers the renderer outside the web root in `/var/lib/comfyui-studio/settings.json`. In-app saved settings take precedence over the service's initial COMFY_URL. To change an existing setup, use **ComfyUI → Save address**.

## Manage and update

```bash
systemctl status comfyui-studio nginx
journalctl -u comfyui-studio --since today
nginx -t
```

Export browser projects and download final videos before upgrades. Restarting removes the service's temporary finishing files. Browser workspaces are specific to the browser and origin; a new IP/port/HTTPS hostname opens a separate workspace. Use Export backup / Import project to migrate.

Fetch a reviewed release, rerun the installer with the same exact frontend origin, and check both AI/ComfyUI connections. The installer restarts the service. Optional private workflows must be installed locally in the deployed app's `workflows/local/` with rights to use them; do not put them in a public archive.

For model, node and workflow requirements see [workflows/README.md](../workflows/README.md). For the trust boundary and private reporting guidance see [SECURITY.md](../SECURITY.md).
