import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SEMVER = /^\d+\.\d+\.\d+$/;
const root = fileURLToPath(new URL("..", import.meta.url));

function readJson(name) {
	return JSON.parse(readFileSync(`${root}${name}`, "utf8"));
}

function writeJson(name, value, indent = "\t") {
	writeFileSync(`${root}${name}`, `${JSON.stringify(value, null, indent)}\n`);
}

const version = process.argv[2];
if (!(version && SEMVER.test(version))) {
	console.error("Usage: version:bump <x.y.z>");
	process.exit(1);
}

const manifest = readJson("manifest.json");
const versions = readJson("versions.json");
const pkg = readJson("package.json");

manifest.version = version;
pkg.version = version;
versions[version] = manifest.minAppVersion;

writeJson("manifest.json", manifest);
writeJson("versions.json", versions);
writeJson("package.json", pkg);

if (existsSync(`${root}package-lock.json`)) {
	const lock = readJson("package-lock.json");
	lock.version = version;
	lock.packages[""].version = version;
	writeJson("package-lock.json", lock, 2);
}
console.log(`Bumped DM Kit Sync to ${version}.`);
