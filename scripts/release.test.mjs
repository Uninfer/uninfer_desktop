import assert from "node:assert/strict";
import test from "node:test";
import { createManifest, parseVersion, selectArtifacts } from "./release.mjs";

test("release manifest references exactly one signed Windows installer", () => {
  const setup = "uninfer_26.8.4_x64-setup.exe";
  assert.deepEqual(selectArtifacts([setup, `${setup}.sig`], "26.8.4"), { setup, signature: `${setup}.sig` });
  assert.equal(JSON.parse(createManifest("26.8.4", "https://example.test/setup.exe", "signature")).platforms["windows-x86_64"].url, "https://example.test/setup.exe");
  assert.throws(() => createManifest("26.8.4", "http://example.test/setup.exe", "signature"));
  assert.throws(() => parseVersion("26.8"));
});
