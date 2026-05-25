'use strict';

require('dotenv').config();

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

const BUILD_DIR = path.resolve(__dirname, 'build');

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
				transform: (content) =>
					new CleanCSS({ level: 2 }).minify(content.toString()).styles,
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
