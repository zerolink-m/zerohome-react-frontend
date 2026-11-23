#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  printf '[release] ERROR: %s\n' "$*" >&2
  exit 1
}

trap 'status=$?; printf "[release] ERROR: command failed at line %s (exit %s)\n" "$LINENO" "$status" >&2; exit "$status"' ERR

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel 2>/dev/null)" \
  || fail 'could not locate the git repository from scripts/release.sh'
cd "$REPO_ROOT"

for tool in git gh node npm cp mkdir grep; do
  command -v "$tool" >/dev/null 2>&1 || fail "required tool is missing: $tool"
done

next_release_version() {
  local current="$1"
  if [[ ! "$current" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-Release$ ]]; then
    fail "package version must match MAJOR.MINOR.PATCH-Release; got: $current"
  fi
  local major="${BASH_REMATCH[1]}"
  local minor="${BASH_REMATCH[2]}"
  local patch="${BASH_REMATCH[3]}"
  printf '%s.%s.%s-Release' "$major" "$minor" "$((10#$patch + 1))"
}

check_unpublished() {
  local version="$1"
  local remote_tags release_check release_status

  remote_tags="$(git ls-remote --tags origin "refs/tags/$version" "refs/tags/$version^{}")" \
    || fail "could not check whether the release tag exists on origin: $version"
  [[ -z "$remote_tags" ]] || fail "release tag already exists on origin: $version; refusing to create another release"
  if git show-ref --verify --quiet "refs/tags/$version"; then
    fail "release tag already exists locally: $version; refusing to create another release"
  fi

  set +e
  release_check="$(gh release view "$version" --json tagName 2>&1)"
  release_status=$?
  set -e
  if [[ "$release_status" -eq 0 ]]; then
    fail "GitHub Release already exists: $version; refusing to bump again"
  fi
  if ! grep -qiE 'release .*not found|not found \(HTTP 404\)|HTTP 404' <<<"$release_check"; then
    printf '%s\n' "$release_check" >&2
    fail "could not verify whether GitHub Release exists: $version"
  fi
}

current_remote_head() {
  local branch="$1"
  local branch_line
  branch_line="$(git ls-remote --heads origin "refs/heads/$branch")" \
    || fail "could not check the pushed branch on origin: $branch"
  printf '%s' "${branch_line%%$'\t'*}"
}

BRANCH="$(git symbolic-ref --quiet --short HEAD)" \
  || fail 'HEAD is detached; check out the branch you intend to release'
HEAD_SHA="$(git rev-parse HEAD)"

if [[ -n "$(git status --porcelain --untracked-files=all)" ]]; then
  git status --short >&2
  fail 'working tree is not clean; commit and push all intended changes before releasing'
fi

ORIGIN_URL="$(git remote get-url origin 2>/dev/null)" \
  || fail 'git remote origin is not configured'
[[ -n "$ORIGIN_URL" ]] || fail 'git remote origin has an empty URL'

gh auth status >/dev/null 2>&1 || fail 'GitHub CLI is not authenticated; run gh auth login first'

REMOTE_HEAD="$(current_remote_head "$BRANCH")"
[[ -n "$REMOTE_HEAD" ]] || fail "branch is not present on origin: $BRANCH"
[[ "$REMOTE_HEAD" == "$HEAD_SHA" ]] \
  || fail "local HEAD ($HEAD_SHA) does not match origin/$BRANCH ($REMOTE_HEAD); push the current commit first"

CURRENT_VERSION="$(node -p "require('./package.json').version")" \
  || fail 'could not read package.json version'
COMMIT_SUBJECT="$(git log -1 --format=%s)"
if [[ "$COMMIT_SUBJECT" == "chore(release): bump version to $CURRENT_VERSION" ]]; then
  fail "a version-bump commit for $CURRENT_VERSION is already pushed; inspect the pending release and resume it manually instead of running another bump"
fi
VERSION="$(next_release_version "$CURRENT_VERSION")"
printf '[release] Next version: %s → %s\n' "$CURRENT_VERSION" "$VERSION"

check_unpublished "$VERSION"

printf '[release] Updating package.json and package-lock.json with npm version…\n'
npm version "$VERSION" --no-git-tag-version \
  || fail "npm could not update the package version to $VERSION"

  PACKAGE_VERSION="$(node -p "require('./package.json').version")"
  LOCK_VERSION="$(node -p "require('./package-lock.json').version")" \
    || fail 'could not read package-lock.json root version'
  LOCK_ROOT_VERSION="$(node -p "require('./package-lock.json').packages[''].version")" \
    || fail 'could not read package-lock.json packages[""] version'
  [[ "$PACKAGE_VERSION" == "$VERSION" ]] \
    || fail "package.json version mismatch after npm version: expected $VERSION, got $PACKAGE_VERSION"
  [[ "$LOCK_VERSION" == "$VERSION" && "$LOCK_ROOT_VERSION" == "$VERSION" ]] \
    || fail "npm version did not update only the package-lock root version fields to $VERSION"

  EXPECTED_LOCK_VERSION="$VERSION" node -e '
    const { execFileSync } = require("node:child_process");
    const fs = require("node:fs");
    const expected = process.env.EXPECTED_LOCK_VERSION;
    const before = JSON.parse(execFileSync("git", ["show", "HEAD:package-lock.json"], { encoding: "utf8" }));
    const after = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
    before.version = expected;
    before.packages[""].version = expected;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      process.stderr.write("package-lock.json changed beyond its root version metadata; refusing to stage it\n");
      process.exit(1);
    }
  ' || fail 'package-lock.json changed beyond root version metadata; refusing to continue'

  while IFS= read -r status_line; do
    [[ -z "$status_line" ]] && continue
    changed_path="${status_line:3}"
    [[ "$changed_path" == 'package.json' || "$changed_path" == 'package-lock.json' ]] \
      || fail "npm version changed an unexpected file: $changed_path"
  done <<<"$(git status --porcelain --untracked-files=all)"

  git add -- package.json package-lock.json \
    || fail 'could not stage package version files'
  mapfile -t STAGED_FILES < <(git diff --cached --name-only)
  [[ ${#STAGED_FILES[@]} -eq 2 ]] || fail 'expected exactly package.json and package-lock.json staged'
  if git diff --cached --name-only | grep -Ev '^(package\.json|package-lock\.json)$' >/dev/null; then
    fail 'unexpected staged files found; refusing to create the version commit'
  fi

  printf '[release] Creating version commit…\n'
  git commit -m "chore(release): bump version to $VERSION" \
    || fail "version files are staged for $VERSION, but the bump commit failed; resolve this before rerunning"
  printf '[release] Pushing version commit to origin/%s…\n' "$BRANCH"
  git push origin "$BRANCH" \
    || fail "version bump commit exists locally but could not be pushed; push it before rerunning to avoid another bump"

  HEAD_SHA="$(git rev-parse HEAD)"
  REMOTE_HEAD="$(current_remote_head "$BRANCH")"
  [[ "$REMOTE_HEAD" == "$HEAD_SHA" ]] \
    || fail "version commit was pushed, but origin/$BRANCH no longer points at $HEAD_SHA; inspect the branch before continuing"
printf '[release] Building production bundle for %s at %s…\n' "$VERSION" "$HEAD_SHA"
npm run build || fail 'production build failed; the pushed version-bump commit remains pending. The script will stop on rerun to avoid creating another bump; inspect and resume this version manually.'
[[ -d dist ]] || fail 'build completed without creating dist/'

shopt -s nullglob
BUILD_FILES=(dist/*)
[[ ${#BUILD_FILES[@]} -gt 0 ]] || fail 'dist/ is empty; no release was published'

printf '[release] Publishing GitHub Release %s…\n' "$VERSION"
gh release create "$VERSION" \
  --title "ZeroCams $VERSION" \
  --generate-notes \
  --target "$HEAD_SHA" \
  || fail "GitHub Release creation failed; version $VERSION remains pending. The script will stop on rerun to avoid creating another bump; resolve the release issue and resume this version manually"

DESTINATION='/var/www/zerocams'
printf '[release] Ensuring deployment directory exists: %s\n' "$DESTINATION"
mkdir -p -- "$DESTINATION" || fail "release $VERSION was published, but the deployment directory could not be created: $DESTINATION"
printf '[release] Copying dist/ into %s…\n' "$DESTINATION"
cp -r -- "${BUILD_FILES[@]}" "$DESTINATION/" \
  || fail "release $VERSION was published, but copying dist/ failed; check permissions for $DESTINATION"

printf '[release] Release %s published from %s and dist/ copied to %s.\n' "$VERSION" "$HEAD_SHA" "$DESTINATION"
