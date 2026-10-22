// Publishes what the «Apps» run built as release vX.Y.Z of this repo, with the latest.json
// that Nori's apps read to update themselves (Riscooo/nori copies it to its website with
// `npm run apps`): node publicar.mjs <artifacts folder> app-vX.Y.Z
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const [folder, tag] = process.argv.slice(2);
const version = tag.replace(/^app-v/, "");
const release = `v${version}`;
const repo = process.env.GITHUB_REPOSITORY;
const base = `https://github.com/${repo}/releases/download/${release}`;
const built = readdirSync(folder, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name));
const find = (name, what) => {
  const file = built.find((path) => basename(path) === name);
  if (!file) throw new Error(`Falta ${what} (${name})`);
  return file;
};

// Each file with the name it gets in the release. The AppImage has none of the version: it
// updates itself in place, so its name would soon be wrong.
const windows = { file: find(`Nori_${version}_x64-setup.exe`, "el instalador de Windows"), name: `Nori_${version}_x64-setup.exe` };
const dmg = { file: find(`Nori_${version}_universal.dmg`, "el .dmg del Mac"), name: `Nori_${version}_universal.dmg` };
const mac = { file: find("Nori.app.tar.gz", "la actualización del Mac"), name: `Nori_${version}_universal.app.tar.gz` };
const linux = { file: find(`Nori_${version}_amd64.AppImage`, "la AppImage"), name: "Nori.AppImage" };
const signed = ({ file, name }) => ({ signature: readFileSync(`${file}.sig`, "utf8").trim(), url: `${base}/${name}` });

mkdirSync("release");
for (const { file, name } of [windows, dmg, mac, linux]) copyFileSync(file, join("release", name));
const latest = {
  version,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": signed(windows),
    "darwin-aarch64": signed(mac),
    "darwin-x86_64": signed(mac),
    "linux-x86_64": signed(linux),
  },
};
writeFileSync("release/latest.json", `${JSON.stringify(latest, null, 2)}\n`);

const assets = readdirSync("release").map((name) => join("release", name));
const gh = (...args) => execFileSync("gh", args, { stdio: "inherit" });
let exists = true;
try {
  execFileSync("gh", ["release", "view", release, "-R", repo], { stdio: "ignore" });
} catch {
  exists = false;
}
if (exists) gh("release", "upload", release, "-R", repo, "--clobber", ...assets);
else
  gh("release", "create", release, "-R", repo, "--latest", "--title", `Nori ${version}`, "--notes",
    "Nori para Windows, Mac y Linux. Descárgala desde https://kizuna-steel.vercel.app/descargar, que te dice cuál es la tuya y cómo instalarla. Una vez instalada, se pone al día sola.",
    ...assets);
console.log(`✓ ${release}: ${assets.map((path) => basename(path)).join(", ")}`);
