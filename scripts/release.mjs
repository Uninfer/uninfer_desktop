import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(join(root, "scripts/release-config.json"), "utf8"));

export function parseVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error(`版本必须是 X.Y.Z，收到: ${version}`);
  return version;
}

export function selectArtifacts(names, version) {
  const setup = names.filter((name) => name.includes(version) && /(?:x64|x86_64)/i.test(name) && /setup\.exe$/i.test(name));
  if (setup.length !== 1) throw new Error(`应找到唯一的 ${version} x64 setup.exe，实际: ${setup.join(", ") || "无"}`);
  const signature = `${setup[0]}.sig`;
  if (names.filter((name) => name === signature).length !== 1) throw new Error(`缺少唯一签名文件 ${signature}`);
  return { setup: setup[0], signature };
}

export function createManifest(version, url, signature) {
  if (!url.startsWith("https://")) throw new Error("更新下载地址必须使用 HTTPS");
  if (!signature) throw new Error("更新签名不能为空");
  return `${JSON.stringify({ version, platforms: { [config.target]: { url, signature } } }, null, 2)}\n`;
}

function run(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function releaseInput(version, directory) {
  if (!existsSync(directory)) throw new Error(`产物目录不存在: ${directory}`);
  const state = JSON.parse(await readFile(join(directory, "release-state.json"), "utf8"));
  if (state.version !== version || state.sourceTag !== `v${version}`) throw new Error("release-state.json 版本或私有 tag 不匹配");
  const { setup, signature } = selectArtifacts(await readdir(directory), version);
  const names = [setup, signature];
  if (Object.keys(state.artifacts ?? {}).sort().join("\n") !== names.sort().join("\n")) throw new Error("release-state.json 产物列表不匹配");
  for (const name of names) {
    const path = join(directory, name);
    const expected = state.artifacts[name];
    if (!expected || await sha256(path) !== expected.sha256 || (await stat(path)).size !== expected.size) throw new Error(`产物校验失败: ${name}`);
  }
  return { state, setup, signature };
}

function requireCleanMaster() {
  if (run("git", ["status", "--porcelain"])) throw new Error("Git 工作树必须干净");
  if (run("git", ["branch", "--show-current"]) !== config.gitee.branch) throw new Error(`必须在 ${config.gitee.branch} 分支发布`);
  if (!run("git", ["remote", "get-url", "origin"]).includes(`${config.gitee.owner}/${config.gitee.repo}`)) throw new Error("origin 不是公开发行仓库");
  run("git", ["fetch", "origin", config.gitee.branch, "--tags"]);
  if (run("git", ["rev-parse", "HEAD"]) !== run("git", ["rev-parse", `origin/${config.gitee.branch}`])) throw new Error(`本地 ${config.gitee.branch} 必须与 origin 一致`);
}

function apiUrl(path) {
  return `${config.gitee.apiBaseUrl}${path}`;
}

async function request(url, options = {}, retries = 0) {
  const { timeout = 15_000, ...fetchOptions } = options;
  const response = await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(timeout) });
  if (response.ok || retries >= 2 || (options.method && options.method !== "GET")) return response;
  await new Promise((resolveRetry) => setTimeout(resolveRetry, 250 * 2 ** retries));
  return request(url, options, retries + 1);
}

async function gitee(path, token, options = {}) {
  const response = await request(apiUrl(path), { ...options, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...options.headers } });
  if (!response.ok) throw new Error(`Gitee API ${options.method ?? "GET"} ${path} 失败: ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function releaseForTag(tag, token) {
  const response = await request(apiUrl(`/repos/${config.gitee.owner}/${config.gitee.repo}/releases/tags/${encodeURIComponent(tag)}`), { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`查询 Release 失败: ${response.status}`);
  return response.json();
}

function attachmentUrl(attachment) {
  const url = attachment.browser_download_url ?? attachment.download_url;
  if (!url?.startsWith("https://")) throw new Error(`附件缺少 HTTPS 下载地址: ${attachment.name}`);
  return url;
}

async function uploadAttachment(release, path, token, name = path.split(/[\\/]/).pop()) {
  const form = new FormData();
  form.set("file", new Blob([await readFile(path)]), name);
  return gitee(`/repos/${config.gitee.owner}/${config.gitee.repo}/releases/${release.id}/attach_files`, token, { method: "POST", body: form, timeout: 120_000 });
}

async function attachmentsFor(release, token) {
  return gitee(`/repos/${config.gitee.owner}/${config.gitee.repo}/releases/${release.id}/attach_files`, token);
}

async function ensureAttachment(release, attachments, name, path, token) {
  if (attachments.some((item) => item.name === name)) return attachments;
  await uploadAttachment(release, path, token, name);
  return attachmentsFor(release, token);
}

async function replaceLatestManifest(release, attachments, manifest, token) {
  for (const attachment of attachments.filter((item) => item.name === "latest.json")) {
    if (!attachment.id) throw new Error("latest.json 缺少附件 ID");
    await gitee(`/repos/${config.gitee.owner}/${config.gitee.repo}/releases/${release.id}/attach_files/${attachment.id}`, token, { method: "DELETE" });
  }
  const form = new FormData();
  form.set("file", new Blob([manifest]), "latest.json");
  await gitee(`/repos/${config.gitee.owner}/${config.gitee.repo}/releases/${release.id}/attach_files`, token, { method: "POST", body: form, timeout: 120_000 });
  return attachmentsFor(release, token);
}

async function publicBytes(url) {
  const response = await request(url, { timeout: 120_000 });
  if (!response.ok) throw new Error(`公开下载失败: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function ensurePublicTag(version, state) {
  const tag = `v${version}`;
  const metadataPath = `releases/${tag}.json`;
  const metadata = `${JSON.stringify({ version, sourceTag: state.sourceTag, sourceCommit: state.sourceCommit, artifacts: state.artifacts }, null, 2)}\n`;
  if (run("git", ["tag", "--list", tag]) === tag) {
    if (run("git", ["show", `${tag}:${metadataPath}`]) !== metadata.trim()) throw new Error("已存在的公开 tag 与私有构建产物不匹配");
    return;
  }
  await mkdir(join(root, "releases"), { recursive: true });
  await writeFile(join(root, metadataPath), metadata);
  run("git", ["add", metadataPath]);
  run("git", ["commit", "-m", `release: ${version}`]);
  run("git", ["push", "origin", config.gitee.branch]);
  run("git", ["tag", tag]);
  run("git", ["push", "origin", tag]);
}

async function publish(version, artifactDir) {
  parseVersion(version);
  const token = process.env.GITEE_ACCESS_TOKEN;
  if (!token) throw new Error("缺少 GITEE_ACCESS_TOKEN");
  requireCleanMaster();
  const { state, setup, signature } = await releaseInput(version, artifactDir);
  await ensurePublicTag(version, state);

  const tag = `v${version}`;
  let release = await releaseForTag(tag, token);
  if (!release) release = await gitee(`/repos/${config.gitee.owner}/${config.gitee.repo}/releases`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tag_name: tag, name: tag, body: `Release ${version}`, target_commitish: tag }) });
  let attachments = await attachmentsFor(release, token);
  const names = [setup, signature];
  if (attachments.some((item) => !names.includes(item.name))) throw new Error("版本 Release 含有非预期附件");
  for (const name of names) attachments = await ensureAttachment(release, attachments, name, join(artifactDir, name), token);
  attachments = await attachmentsFor(release, token);
  if (attachments.length !== 2 || !names.every((name) => attachments.some((item) => item.name === name))) throw new Error("版本 Release 附件不完整");
  const setupAttachment = attachments.find((item) => item.name === setup);
  const signatureAttachment = attachments.find((item) => item.name === signature);
  const manifest = createManifest(version, attachmentUrl(setupAttachment), await readFile(join(artifactDir, signature), "utf8"));
  if (createHash("sha256").update(await publicBytes(attachmentUrl(setupAttachment))).digest("hex") !== state.artifacts[setup].sha256) throw new Error("公开 setup.exe 哈希不匹配");
  if (!(await publicBytes(attachmentUrl(signatureAttachment))).equals(await readFile(join(artifactDir, signature)))) throw new Error("公开签名文件不匹配");

  let latest = await releaseForTag(config.latestTag, token);
  if (!latest) latest = await gitee(`/repos/${config.gitee.owner}/${config.gitee.repo}/releases`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tag_name: config.latestTag, name: config.latestTag, body: "Latest update manifest", target_commitish: tag }) });
  const latestAttachments = await replaceLatestManifest(latest, await attachmentsFor(latest, token), manifest, token);
  if (latestAttachments.length !== 1 || latestAttachments[0].name !== "latest.json") throw new Error("latest Release 附件不完整");
  if (!(await publicBytes(config.manifestUrl)).equals(Buffer.from(manifest))) throw new Error("latest.json 与本地清单不一致");
  console.log(`已发布 ${tag}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, artifactDir] = process.argv.slice(2);
  if (!version || !artifactDir) throw new Error("用法: npm run release -- 26.8.4 D:\\path\\to\\release\\v26.8.4");
  await publish(version, resolve(artifactDir));
}
