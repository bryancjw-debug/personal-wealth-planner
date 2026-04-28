import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const root = process.cwd();
const dist = path.join(root, "dist");
const deploy = path.join(root, "deploy");
const standalone = path.join(root, "standalone.html");
const netlifyDir = path.join(deploy, "netlify");
const cloudflareDir = path.join(deploy, "cloudflare-pages");

async function copyDir(source, target) {
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) await copyDir(sourcePath, targetPath);
    else await fs.copyFile(sourcePath, targetPath);
  }
}

async function inlineStandalone() {
  let html = await fs.readFile(path.join(dist, "index.html"), "utf8");
  const scriptMatch = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
  const cssMatch = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);

  if (cssMatch) {
    const css = await fs.readFile(path.join(dist, cssMatch[1]), "utf8");
    html = html.replace(cssMatch[0], `<style>${css}</style>`);
  }

  if (scriptMatch) {
    const js = await fs.readFile(path.join(dist, scriptMatch[1]), "utf8");
    html = html.replace(scriptMatch[0], `<script type="module">${js}</script>`);
  }

  await fs.writeFile(standalone, html);
}

async function zipDir(source, zipPath) {
  const zip = new JSZip();

  async function add(current, folder) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await add(fullPath, folder.folder(entry.name));
      else folder.file(entry.name, await fs.readFile(fullPath));
    }
  }

  await add(source, zip);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await fs.writeFile(zipPath, buffer);
}

await fs.mkdir(deploy, { recursive: true });
await inlineStandalone();
await copyDir(dist, netlifyDir);
await copyDir(dist, cloudflareDir);

await fs.writeFile(path.join(netlifyDir, "netlify.toml"), `[build]\n  publish = "."\n\n[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200\n`);
await fs.writeFile(path.join(cloudflareDir, "_headers"), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
await fs.writeFile(path.join(cloudflareDir, "_redirects"), `/* /index.html 200\n`);

await zipDir(netlifyDir, path.join(deploy, "financial-projection-netlify.zip"));
await zipDir(cloudflareDir, path.join(deploy, "financial-projection-cloudflare-pages.zip"));

console.log("Created standalone.html, deploy/netlify, deploy/cloudflare-pages, and deployment zip packages.");
