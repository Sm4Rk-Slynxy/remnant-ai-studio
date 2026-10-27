# Contributing

Keep changes focused and preserve compatibility with existing browser backups. Use fictional, general-audience examples. Never commit projects, API keys, LAN inventories, imported third-party workflow files or generated personal media. Optional private integrations belong in `workflows/local/`.

## Checks

Runtime: Python 3.10+ and FFmpeg. Development: Node.js 22+, npm and Playwright Chromium.

```bash
npm test
python3 -m unittest discover -s tests -p '*_test.py'
python3 tools/check-release.py
```

Install browser-test dependencies explicitly (no production npm dependencies):

```bash
npm ci
npx playwright install chromium
python3 studio-server.py --port 8101 --settings-file /tmp/remnant-test-settings.json
# In another terminal:
STUDIO_URL=http://127.0.0.1:8101 npm run test:browser
```

Use a dedicated test settings file, unused port and fresh Playwright profile. Tests mock GPU/AI calls and synthesize small media fixtures. Do not point tests at a live production browser profile. The FFmpeg integration suite actually encodes, trims and joins videos but does not download models or queue GPU renders.

`npm run screenshots` captures the real UI with synthetic example data and illustrations. Keep screenshot text free of private endpoints, user names, API keys and real project data. After reviewing the images, run the release scanner again.

For workflow interface changes, add a representative synthetic fixture and meaningful wiring tests. Synthetic graphs must remain clearly test-only. Include redistribution permission and original attribution before bundling third-party assets. Document limitations rather than promising unverified quality or model compatibility.
