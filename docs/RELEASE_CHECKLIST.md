# Public-release checklist

## Prepared in this package

- [x] Clean release copy made separately from the private production workspace.
- [x] Personal projects, songs, renders, inventories, endpoint defaults and original screenshots excluded.
- [x] Private-file serving and imported-collection injection fixed with regression tests.
- [x] ComfyUI redirects and active-content responses blocked.
- [x] MIT license for original app code; third-party workflow/model rights documented separately.
- [x] Unknown-permission workflows omitted; optional local installation documented.
- [x] Fictional demo screenshots, install guide, contribution/security docs and CI added.
- [x] Ignore rules and a tracked-file release scanner supplied.

## Before making the GitHub repository public

- [ ] Review the exact tracked file list and fresh screenshot images. Never upload the original private workspace as a ZIP or import its history.
- [ ] Run the documented unit, HTTP/security, FFmpeg and browser checks on the final commit. See CODE_REVIEW.md for this preparation run's results and limits.
- [ ] Create `remnant-ai-studio` under the intended GitHub owner and push this clean tree. Choose an appropriate Git author identity; no developer-machine email is bundled.
- [ ] Enable GitHub private vulnerability reporting and secret scanning/push protection where available.
- [ ] Protect the default branch; require CI for pull requests. Choose who may approve workflow changes.
- [ ] Set the About description/topics and review the README links after publication.
- [ ] Test installation from a fresh clone/container and verify the separately installed workflow versions on a supported GPU before claiming a stable release.

## Ongoing

Maintain dependency/custom-node compatibility notes, issue templates, tagged releases and a changelog. Back up browser projects and download final media before restarts/upgrades. Confirm third-party redistribution rights before adding assets. Keep the deployed studio on a trusted network or behind authentication even though the source repository is public.

GitHub's [repository security quickstart](https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository) describes repository settings and security policies. See also [secret scanning alerts](https://docs.github.com/en/code-security/concepts/secret-security/about-alerts). These platform features complement review; a clean heuristic scan does not prove a repository contains no sensitive data.
