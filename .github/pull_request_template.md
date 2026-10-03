## Summary

<what changed and why>

Part of HAZ-xx

## Checklist

- [ ] Previewed in a real browser at 1440 and 390, compared to mock/reference, iterated until complete

## Proof

Delete the block that does not apply. A missing Proof kind line is checked as ui.

### UI

Proof kind: ui

A desktop image, a 390px image, and a clickable preview link. The shots are image embeds (a markdown image or an img tag), not plain links. Do not use shots of test output, a terminal, or code.

- Desktop screenshot: ![desktop](paste-https-image-url)
- 390px screenshot: ![390px](paste-https-image-url)
- Preview link: paste-https-preview-url

### Non-UI

Proof kind: non-ui

Backend, tooling, or tests. A Result line and at least one link (the PR, a CI run, a preview, or a live URL). No screenshots of test output, a terminal, or code. A diagram is fine.

- Result: <what the checks printed, for example node --test 36/36>
- PR: paste-https-pull-url
- CI run: paste-https-actions-run-url
- Preview or live: paste-https-url
