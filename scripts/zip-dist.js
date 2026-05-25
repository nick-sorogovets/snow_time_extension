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

function validateBuild(manifest) {
	const missing = collectManifestPaths(manifest).filter(
		(rel) => !fs.existsSync(path.join(BUILD_DIR, rel))
	);
	if (missing.length) {
		throw new Error(
			`Build is missing files referenced in manifest.json:\n${missing.map((p) => `  - ${p}`).join('\n')}`
		);
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
