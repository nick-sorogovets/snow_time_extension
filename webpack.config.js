'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');

	const PROD_OAUTH_CLIENT_ID = process.env.PROD_OAUTH_CLIENT_ID?.trim();
	if (!PROD_OAUTH_CLIENT_ID) {
		throw new Error(
			'PROD_OAUTH_CLIENT_ID is not set. Copy .env.example to .env and add your production OAuth client id.'
		);
	}

	const MANIFEST_KEY_PATH = path.join(__dirname, '.keys', 'manifest-key.txt');
	const MANIFEST_KEY =
		process.env.MANIFEST_KEY?.trim() ||
		(fs.existsSync(MANIFEST_KEY_PATH)
			? fs.readFileSync(MANIFEST_KEY_PATH, 'utf8').trim()
			: '');

const BUILD_DIR = path.resolve(__dirname, 'build');
const STYLES_SRC = path.join(__dirname, 'src/styles');
const IMPORT_RE = /@import\s+url\s*\(\s*['"]?\.\/_tokens\.css['"]?\s*\)\s*;?/;

function minifyCss(css) {
	return new CleanCSS({ level: 2 }).minify(css).styles;
}

/** Bundle _tokens.css into page styles; CleanCSS alone drops unresolved @imports. */
function transformStyleFile(content, absolutePath) {
	const css = content.toString();
	const base = path.basename(absolutePath);

	if (base === '_tokens.css') {
		return minifyCss(css);
	}

	if (base === 'popup.css' || base === 'options.css') {
		const tokens = fs.readFileSync(path.join(STYLES_SRC, '_tokens.css'), 'utf8');
		const pageCss = css.replace(IMPORT_RE, '').trim();
		return minifyCss(`${tokens}\n${pageCss}`);
	}

	return css;
}

function createCopyPlugin() {
	return new CopyWebpackPlugin({
		patterns: [
			{
				from: 'src/img',
				to: 'img',
				globOptions: {
					ignore: ['**/*.pdn'],
				},
				filter: (resourcePath) => /\.(png|svg)$/i.test(resourcePath),
			},
			{
				from: 'src/*.html',
				to: '[name][ext]',
				transform: async (content) =>
					minifyHtml(content.toString(), {
						collapseWhitespace: true,
						removeComments: true,
						minifyCSS: true,
						minifyJS: true,
					}),
			},
			{
				from: 'src/styles',
				to: 'styles',
				transform: transformStyleFile,
			},
			{
				from: 'src/_locales',
				to: '_locales',
			},
			{
				from: 'src/manifest.json',
				to: 'manifest.json',
				transform: (content) => {
					const manifest = JSON.parse(content.toString());
					manifest.oauth2.client_id = PROD_OAUTH_CLIENT_ID;
					if (MANIFEST_KEY) {
						manifest.key = MANIFEST_KEY;
					}
					return JSON.stringify(manifest, null, '\t');
				},
			},
		],
	});
}

const sharedOptimization = {
	minimize: true,
	minimizer: [
		new TerserPlugin({
			extractComments: false,
		}),
	],
};

/** MV3 extension pages + service worker (ES modules). */
const extensionModules = {
	name: 'extension-modules',
	entry: {
		popup: './src/js/popup.js',
		options: './src/js/options.js',
		background: './src/js/background.js',
	},
	output: {
		path: BUILD_DIR,
		filename: 'js/[name].js',
		module: true,
		chunkFormat: 'module',
		environment: {
			module: true,
			dynamicImport: true,
		},
	},
	experiments: {
		outputModule: true,
	},
	optimization: {
		...sharedOptimization,
		minimizer: [
			new TerserPlugin({
				extractComments: false,
				terserOptions: {
					format: { comments: false },
					module: true,
				},
			}),
		],
	},
	plugins: [createCopyPlugin()],
};

/** SNOW content script (classic script, no imports). */
const contentScript = {
	name: 'content-script',
	entry: {
		content: './src/js/content.js',
	},
	output: {
		path: BUILD_DIR,
		filename: 'js/[name].js',
	},
	optimization: sharedOptimization,
};

module.exports = [extensionModules, contentScript];
