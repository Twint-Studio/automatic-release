# Automatic Release

A tiny GitHub Action to create or replace a release for a tag, upload assets, and optionally auto-generate release notes.

## Quick start

```yaml
name: Release
on:
  push:
    tags: ["v*"]
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Twint-Studio/automatic-release@main
        with:
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          files: dist/*
```

## Moving a "latest" pre-release

```yaml
- uses: Twint-Studio/automatic-release@main
  with:
    repo_token: ${{ secrets.GITHUB_TOKEN }}
    tag: latest
    prerelease: true
    generate_release_notes: false   # no notes
    body: ""                        # no body
    files: build/*
```

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `repo_token` **(required)** | – | Usually `${{ secrets.GITHUB_TOKEN }}` |
| `tag` | pushed tag | Tag to release |
| `title` | tag name | Release title |
| `draft` | `false` | Create a draft |
| `prerelease` | `false` | Mark as pre-release |
| `generate_release_notes` | `true` | Use GitHub-generated notes |
| `body` | `""` | Custom notes (used when `generate_release_notes: false`) |
| `files` | `""` | Newline-separated glob patterns to upload |
| `overwrite` | `true` | Delete and recreate an existing release/tag |

## Outputs

`release_id`, `tag`, `upload_url`, `html_url`

## Dev

```bash
npm install && npm run check && npm run build
```
