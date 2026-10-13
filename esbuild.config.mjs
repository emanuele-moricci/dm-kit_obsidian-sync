import { builtinModules } from "node:module";
import esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const production = !watch;

const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/*",
		"@lezer/*",
		...builtinModules,
	],
	format: "cjs",
	target: "es2022",
	platform: "browser",
	logLevel: "info",
	sourcemap: production ? false : "inline",
	minify: production,
	treeShaking: true,
	outfile: "main.js",
});

if (watch) {
	await context.watch();
} else {
	await context.rebuild();
	await context.dispose();
}
