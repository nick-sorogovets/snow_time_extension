'use strict';

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');
const DIST_DIR = path.join(ROOT, 'dist');

function collectManifestPaths(manifest) {
	const paths = new Set();
	if (manifest.icons) {
		for (const iconPath of Object.values(manifest.icons)) paths.add(iconPath);
	}
	if (manifest.action?.default_icon) {
		for (const iconPath of Object.values(manifest.action.default_icon)) {
			paths.add(iconPath);
		}
	}
	return [...paths];
}

function collectHtmlAssetPaths(html) {
	const paths = new Set();
	for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
		const ref = match[1];
		if (
			ref.startsWith('http:') ||
			ref.startsWith('https:') ||
			ref.startsWith('data:') ||
			ref.startsWith('#') ||
			ref.startsWith('mailto:')
		) {
			continue;
		}
		paths.add(ref.replace(/^\.\//, ''));
	}
	return [...paths];
}

function validateBuild(manifest) {
	const missing = new Set(collectManifestPaths(manifest).filter(
		(rel) => !fs.existsSync(path.join(BUILD_DIR, rel))
	));

	for (const page of ['popup.html', 'options.html']) {
		const htmlPath = path.join(BUILD_DIR, page);
		if (!fs.existsSync(htmlPath)) continue;
		const html = fs.readFileSync(htmlPath, 'utf8');
		for (const rel of collectHtmlAssetPaths(html)) {
			if (!fs.existsSync(path.join(BUILD_DIR, rel))) {
				missing.add(`${page} → ${rel}`);
			}
		}
	}

	if (missing.size) {
		throw new Error(
			`Build is missing files referenced in manifest or HTML:\n${[...missing].map((p) => `  - ${p}`).join('\n')}`
		);
	}

	for (const sheet of ['styles/popup.css', 'styles/options.css']) {
		const css = fs.readFileSync(path.join(BUILD_DIR, sheet), 'utf8');
		if (!css.includes(':root{') && !css.includes(':root {')) {
			throw new Error(
				`${sheet} is missing bundled design tokens (:root). Check webpack CSS transform.`
			);
		}
	}
}

function zipBuild() {
	const manifest = JSON.parse(
		fs.readFileSync(path.join(BUILD_DIR, 'manifest.json'), 'utf8')
	);
	validateBuild(manifest);

	const en = JSON.parse(
		fs.readFileSync(path.join(ROOT, 'src/i18n/en.json'), 'utf8')
	);
	const displayName =
		manifest.name.startsWith('__MSG_') && en.extension_name
			? en.extension_name
			: manifest.name;
	const zipName = `${displayName} v${manifest.version}.zip`;
	const zipPath = path.join(DIST_DIR, zipName);

	fs.mkdirSync(DIST_DIR, { recursive: true });

	const output = fs.createWriteStream(zipPath);
	const archive = archiver('zip', { zlib: { level: 9 } });

	return new Promise((resolve, reject) => {
		output.on('close', () => {
			console.log(`[zip] wrote ${zipPath} (${archive.pointer()} bytes)`);
			resolve();
		});
		archive.on('error', reject);
		archive.pipe(output);
		archive.directory(BUILD_DIR, false);
		archive.finalize();
	});
}

zipBuild().catch((err) => {
	console.error(err);
	process.exit(1);
});
