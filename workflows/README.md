# Workflows and separate permissions

The app-authored `h3-scene-first-last-api.json` and `krea2-scene-image-api.json` templates are covered by the application's MIT license. They contain no model weights. Node and model names describe expected interfaces, not an endorsement or a bundled dependency.

## Built-in generation

Use **ComfyUI → Load H3 start / end preset** and **Image studio → Refresh models**. Model/encoder/VAE names are resolved against the connected server. Install the appropriate H3/Krea models, encoder, VAE, four-step LoRA and required custom nodes on that server first. Compatibility is checked before submission. API node interfaces change: export/map your own API graph if your installed version differs.

Start/end guidance and last-frame continuation improve continuity; they do not guarantee identical characters or seamless motion in every result. Review each take.

## Optional privately installed integrations

The original uploaded Krea editor, MICW character and Photoshoot Series workflows had no confirmed redistribution grant in their files. They are deliberately excluded from this public release, together with their example prompts, embedded metadata and the server's option inventory. Obtain them independently from their authors and follow their terms.

Install the versions for which these wrappers were written, using copies you are entitled to use:

```bash
python3 tools/install-local-workflows.py   --character-api /path/to/micw-all-in-one-character-api.json
python3 tools/install-local-workflows.py   --photoshoot-api /path/to/photoshoot-series-api.json   --photoshoot-options /path/to/photoshoot-options.json
# Optional editor compatibility report:
python3 tools/install-local-workflows.py   --krea-editor /path/to/krea2-pro-grade-source.json
```

The installer validates JSON shape and stores these files in ignored `workflows/local/`. It never downloads code or installs custom nodes. Restart is unnecessary. Do not commit this folder or assume the application's MIT license grants rights to its contents. Review workflows for embedded credentials, private paths, prompts and external service nodes before using them.

The character wrapper expects the MICW expanded API graph IDs used by `character-workflow.js`. The photoshoot wrapper expects its original person/series nodes and serialized `PersonState`/`ShootingState` schema. Arbitrary unrelated workflows are not interchangeable; use **Import API workflow** in ComfyUI/Image Studio for generic mapped workflows instead.

Synthetic files in `tests/fixtures/` test the wrapper contract only. They are not working generation workflows and are never served by the app.
