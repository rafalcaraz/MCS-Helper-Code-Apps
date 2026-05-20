#!/usr/bin/env node
// Build all Code Apps in the monorepo and pack them into a single solution zip.
//
// Steps (for each app in APPS):
//   1. npm --prefix <folder> run build        -> produces <folder>/dist/
//   2. clear + copy dist/*                    -> solution/src/CanvasApps/<app>_CodeAppPackages/
//   3. regenerate <CodeAppPackageUris>        -> solution/src/CanvasApps/<app>.meta.xml
// Then:
//   4. pac solution pack                      -> solution/out/<SOLUTION>.zip
//
// Output zip is self-contained: a contributor can clone, run this, import the
// zip, wire the connection references + turn on the flows, and have all apps
// working — no `npm install` or `power-apps push` required on their end.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const SOLUTION_NAME = "MCSHelperCodeApps";

// Each app in the shared solution. Keep in sync with pull-solution.mjs and
// with the <RootComponent> entries in solution/src/Other/Solution.xml.
const APPS = [
  { folder: "MCSTranscriptViewer", appName: "msftcsa_mcsconversationviewer_6ae15" },
  { folder: "AgentEvalsViewer",    appName: "msftcsa_agentevaluationsviewer_dd752" },
];

// CLI: --managed (default: unmanaged)
const args = process.argv.slice(2);
const packageType = args.includes("--managed") ? "Managed" : "Unmanaged";

// Timestamp suffix: _MMDDYY_HHMM (local time)
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${pad(now.getMonth() + 1)}${pad(now.getDate())}${String(now.getFullYear()).slice(-2)}_${pad(now.getHours())}${pad(now.getMinutes())}`;
const zipName = `${SOLUTION_NAME}_${packageType.toLowerCase()}_${stamp}.zip`;

const solutionSrc = path.join(repoRoot, "solution", "src");
const solutionOut = path.join(repoRoot, "solution", "out");
const zipPath = path.join(solutionOut, zipName);

const MIME_BY_EXT = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};

function log(msg) {
  console.log(`\n▶ ${msg}`);
}

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: repoRoot, shell: true, ...opts });
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    throw new Error(
      `Unknown MIME type for extension "${ext}" (${file}). Add it to MIME_BY_EXT in scripts/pack-solution.mjs.`,
    );
  }
  return mime;
}

async function regenerateMetaXml(appName, bundleDir, metaXmlPath) {
  const files = await walk(bundleDir);
  // Stable order: index.html first, then alphabetised — matches Power Apps
  // export ordering closely enough for clean diffs.
  const rels = files
    .map((f) => path.relative(bundleDir, f).split(path.sep).join("/"))
    .sort((a, b) => {
      if (a === "index.html") return -1;
      if (b === "index.html") return 1;
      return a.localeCompare(b);
    });

  const uriLines = rels
    .map(
      (rel) =>
        `    <CodeAppPackageUri>/CanvasApps/${appName}_CodeAppPackages/${rel}_ContentType_${mimeFor(rel)}</CodeAppPackageUri>`,
    )
    .join("\n");

  const newBlock = `<CodeAppPackageUris>\n${uriLines}\n  </CodeAppPackageUris>`;

  const xml = readFileSync(metaXmlPath, "utf8");
  const updated = xml.replace(
    /<CodeAppPackageUris>[\s\S]*?<\/CodeAppPackageUris>/,
    newBlock,
  );

  if (updated === xml) {
    throw new Error(
      `Failed to locate <CodeAppPackageUris>...</CodeAppPackageUris> block in ${metaXmlPath}`,
    );
  }

  writeFileSync(metaXmlPath, updated, "utf8");
  console.log(`  ✓ rewrote ${rels.length} <CodeAppPackageUri> entries`);
}

async function buildAndBundle({ folder, appName }) {
  const appRoot = path.join(repoRoot, folder);
  const distDir = path.join(appRoot, "dist");
  const bundleDir = path.join(solutionSrc, "CanvasApps", `${appName}_CodeAppPackages`);
  const metaXmlPath = path.join(solutionSrc, "CanvasApps", `${appName}.meta.xml`);

  log(`[${folder}] Building Code App (npm run build)`);
  run(`npm --prefix "${folder}" run build`);

  await stat(distDir).catch(() => {
    throw new Error(`dist/ not found at ${distDir} after build`);
  });

  log(`[${folder}] Refreshing bundle in ${path.relative(repoRoot, bundleDir).split(path.sep).join("/")}`);
  rmSync(bundleDir, { recursive: true, force: true });
  mkdirSync(bundleDir, { recursive: true });
  cpSync(distDir, bundleDir, { recursive: true });

  log(`[${folder}] Regenerating <CodeAppPackageUris> in ${path.basename(metaXmlPath)}`);
  await regenerateMetaXml(appName, bundleDir, metaXmlPath);
}

async function main() {
  for (const app of APPS) {
    await buildAndBundle(app);
  }

  log(`Packing ${packageType.toLowerCase()} solution`);
  mkdirSync(solutionOut, { recursive: true });
  rmSync(zipPath, { force: true });

  // pac solution pack reads <Managed> from Solution.xml and refuses to produce
  // a zip whose type doesn't match. Flip it for the duration of the pack, then
  // restore — keeps the source-of-truth Solution.xml as Unmanaged in git.
  const solutionXmlPath = path.join(solutionSrc, "Other", "Solution.xml");
  const originalSolutionXml = readFileSync(solutionXmlPath, "utf8");
  const wantManagedFlag = packageType === "Managed" ? "1" : "0";
  const flipped = originalSolutionXml.replace(
    /<Managed>[01]<\/Managed>/,
    `<Managed>${wantManagedFlag}</Managed>`,
  );
  if (flipped === originalSolutionXml && !originalSolutionXml.includes(`<Managed>${wantManagedFlag}</Managed>`)) {
    throw new Error(`Could not locate <Managed>...</Managed> in ${solutionXmlPath}`);
  }
  writeFileSync(solutionXmlPath, flipped, "utf8");

  const relZip = path.relative(repoRoot, zipPath).split(path.sep).join("/");
  try {
    run(
      `pac solution pack --folder solution/src --zipFile "${relZip}" --packageType ${packageType}`,
    );
  } finally {
    writeFileSync(solutionXmlPath, originalSolutionXml, "utf8");
  }

  // pac sometimes exits 0 even when it refuses to produce the zip — verify.
  await stat(zipPath).catch(() => {
    throw new Error(`pac solution pack reported success but ${path.relative(repoRoot, zipPath)} was not created. Scroll up for the pac error.`);
  });

  log("Done");
  console.log(`  📦 ${relZip}`);
  console.log(`\nNext: import the zip into a Dataverse env, wire the connection references, turn on the flows.`);
}

main().catch((err) => {
  console.error(`\n✗ pack-solution failed: ${err.message}`);
  process.exit(1);
});
