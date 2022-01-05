'use strict';

//npm install --save-dev gulp jshint gulp-jshint gulp-minify-css gulp-uglify gulp-clean gulp-cleanhtml gulp-strip-debug gulp-zip gulp-json-modify

const gulp = require('gulp');
const clean = require('gulp-clean');
const cleanhtml = require('gulp-cleanhtml');
const cleancss = require('gulp-clean-css');
const jshint = require('gulp-jshint');
const stripdebug = require('gulp-strip-debug');
const uglify = require('gulp-uglify');
const zip = require('gulp-zip');
const jsonModify = require('gulp-json-modify');

//clean build directory
gulp.task('clean', function () {
	gulp.src('build/*', { read: false }).pipe(clean());
	return gulp.src('dist/*', { read: false }).pipe(clean());
});

//copy static folders to build directory
gulp.task('copy', function () {
	gulp.src('src/img/*.png', { read: true }).pipe(gulp.dest('build/img'));
	gulp.src('node_modules/jquery/dist/jquery.min.js').pipe(gulp.dest('build'));
	return gulp
		.src('src/manifest.json')
		.pipe(
			jsonModify({
				key: 'oauth2.client_id',
				value: '384905528545-jcek023539jsr0c42dtbsldeaav37knb.apps.googleusercontent.com',
			})
		)
		.pipe(gulp.dest('build'));
});

//copy and compress HTML files
gulp.task('html', function () {
	return gulp.src('src/*.html')
	.pipe(cleanhtml())
	.pipe(gulp.dest('build'));
});

//run scripts through JSHint
gulp.task('jshint', function () {
	// return gulp.src('src/js/*.js')
	// 	.pipe(jshint())
	// 	.pipe(jshint.reporter('default'));
});

//copy vendor scripts and uglify all other scripts, creating source maps
gulp.task('scripts', ['jshint'], function () {
	return (
		gulp
			.src(['src/js/**/*.js'])
			//.pipe(stripdebug())
			.pipe(
				uglify({
					compress: true,
					mangle: true
				}).on('error', function (e) {
					console.log(e);
				})
			)
			.pipe(gulp.dest('build/js'))
	);
});

//minify styles
gulp.task('styles', function () {
	return gulp
		.src('src/styles/**/*.css')
		.pipe(
			cleancss({
				root: 'src/styles',
				keepSpecialComments: 0,
				relativeTo: 'src/styles',
				target: 'src/styles',
			})
		)
		.pipe(gulp.dest('build/styles'));
	// return gulp.src('src/styles/**')
	// 	.pipe(gulp.dest('build/styles'));
});

//build ditributable and sourcemaps after other tasks completed
gulp.task('zip', ['html', 'scripts', 'styles', 'copy'], function () {
	var manifest = require('./src/manifest'),
		distFileName = manifest.name + ' v' + manifest.version + '.zip',
		mapFileName = manifest.name + ' v' + manifest.version + '-maps.zip';
	//collect all source maps
	gulp.src('build/scripts/**/*.map')
	.pipe(zip(mapFileName))
	.pipe(gulp.dest('dist'));
	//build distributable extension
	return gulp
		.src(['build/**', '!build/scripts/**/*.map'])
		.pipe(zip(distFileName))
		.pipe(gulp.dest('dist'));
});

//run all tasks after build directory has been cleaned
gulp.task('default', ['clean'], function () {
	gulp.start('zip');
});
