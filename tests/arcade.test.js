import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

test("arcade.json matches the manifest and points at real files", () => {
  const arcade = JSON.parse(read("arcade.json"));
  assert.deepEqual(arcade, {
    name: "Dig Wars",
    id: "digwars",
    icon: "assets/icon.jpg",
    cover: "assets/cover.jpg",
    launch: {
      mac: "./launch-mac.command",
      windows: "launch-windows.bat",
      linux: "./launch-linux.sh",
      web: "index.html",
    },
    players: 4,
    port: 8803,
    minPlayers: 1,
    input: ["keyboard", "gamepad"],
    version: "1.0.0",
  });
  for (const relative of [arcade.icon, arcade.cover, arcade.launch.web]) {
    assert.equal(fs.existsSync(path.join(root, relative)), true, relative);
  }
  for (const relative of [arcade.launch.mac, arcade.launch.linux, arcade.launch.windows]) {
    const file = relative.replace(/^\.\//, "");
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
  const server = read("server.py");
  assert.match(server, new RegExp(`\\b${arcade.port}\\b`));
  if (process.platform !== "win32") {
    assert.ok(fs.statSync(path.join(root, "launch-mac.command")).mode & 0o111);
    assert.ok(fs.statSync(path.join(root, "launch-linux.sh")).mode & 0o111);
  }
});

test("the page is offline canvas markup with no CDN", () => {
  const html = read("index.html");
  assert.match(html, /<canvas/);
  assert.match(html, /src\/ui\/main\.js/);
  assert.match(html, /Dig Wars/);
  assert.doesNotMatch(html, /https?:\/\//);
  const sources = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) sources.push(fs.readFileSync(full, "utf8"));
    }
  }
  walk(path.join(root, "src"));
  for (const source of sources) assert.doesNotMatch(source, /https?:\/\//);
});
