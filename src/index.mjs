import * as github from "@actions/github";
import * as core from "@actions/core";
import * as glob from "@actions/glob";
import path from "node:path";
import fs from "node:fs";

function getBooleanInput(name, value) {
    const raw = core.getInput(name);
    if (!raw) return value;

    return /^true$/i.test(raw);
}

function resolveTag(tag) {
    if (tag) return tag.replace(/^refs\/tags\//, "");

    const ref = github.context.ref || "";
    if (ref.startsWith("refs/tags/")) return ref.replace("refs/tags/", "");

    throw new Error("No release tag provided. Set the \"tag\" input or run this action from a tag ref.");
}

async function findReleaseByTag(kit, owner, repo, tag) {
    try {
        const { data } = await kit.rest.repos.getReleaseByTag({ owner, repo, tag });
        return data;
    } catch (error) {
        if (error && error.status === 404) return null;
        throw error;
    }
}

async function deleteReleaseAndTag(kit, owner, repo, release, tag) {
    if (release) {
        core.info(`Deleting existing release "${release.name || release.tag_name}" (id ${release.id})`);
        await kit.rest.repos.deleteRelease({ owner, repo, release_id: release.id });
    }

    try {
        core.info(`Deleting existing tag ref "tags/${tag}"`);
        await kit.rest.git.deleteRef({ owner, repo, ref: `tags/${tag}` });
    } catch (error) {
        if (error && error.status === 404) core.info(`Tag "tags/${tag}" does not exist, skipping tag deletion`);
        else throw error;
    }
}

async function ensureTagRef(kit, owner, repo, tag, sha) {
    const ref = `refs/tags/${tag}`;

    try {
        await kit.rest.git.createRef({ owner, repo, ref, sha });
        core.info(`Created tag ref ${ref} at ${sha}`);
    } catch (error) {
        if (error && error.status === 422) {
          await kit.rest.git.updateRef({ owner, repo, ref: `tags/${tag}`, sha, force: true });
          core.info(`Updated tag ref ${ref} to ${sha}`);
        } else throw error;
    }
}

async function uploadAssets(kit, url, patterns) {
    const input = patterns.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (input.length === 0) return;

    const globber = await glob.create(input.join("\n"), { followSymbolicLinks: false });

    const files = await globber.glob();
    if (files.length === 0) {
        core.warning(`No files matched patterns:\n${input.join("\n")}`);
        return;
    }

    for (const file of files) {
        const stat = fs.statSync(file);
        if (!stat.isFile()) continue;

        const name = path.basename(file);
        const data = fs.readFileSync(file);

        core.info(`Uploading asset: ${name}`);

        await kit.rest.repos.uploadReleaseAsset({
            url,
            headers: {
                "content-type": "application/octet-stream",
                "content-length": stat.size
            },
            name,
            data
        });
    }
}

async function run() {
    try {
        const token = core.getInput("repo_token", { required: true });
        const tag = resolveTag(core.getInput("tag"));
        const title = core.getInput("title") || tag;
        const draft = getBooleanInput("draft", false);
        const prerelease = getBooleanInput("prerelease", false);
        const generate = getBooleanInput("generate_release_notes", true);
        const body = core.getInput("body") || "";
        const files = core.getInput("files") || "";
        const overwrite = getBooleanInput("overwrite", true);

        const { owner, repo } = github.context.repo;

        const kit = github.getOctokit(token);
        const sha = github.context.sha;

        core.info(`Preparing release for ${owner}/${repo} tag "${tag}"`);

        if (overwrite) {
            const existing = await findReleaseByTag(kit, owner, repo, tag);
            await deleteReleaseAndTag(kit, owner, repo, existing, tag);
            await ensureTagRef(kit, owner, repo, tag, sha);
        }

        const params = { owner, repo, tag_name: tag, name: title, draft, prerelease, generate_release_notes: generate };
        if (!generate) params.body = body;

        core.info("Creating release");

        const { data: release } = await kit.rest.repos.createRelease(params);

        await uploadAssets(kit, release.upload_url, files);

        core.setOutput("release_id", String(release.id));
        core.setOutput("tag", release.tag_name);
        core.setOutput("upload_url", release.upload_url);
        core.setOutput("html_url", release.html_url || "");

        core.info(`Release created: ${release.html_url || release.tag_name}`);
    } catch (error) {
        core.setFailed(error instanceof Error ? error.message : String(error));
    }
}

run();
