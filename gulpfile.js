/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
 /* jshint debug: true, strict: true */
(function () {
  'use strict';
  var gulp = require('gulp');
  var $ = require('gulp-load-plugins')();
  var del = require('del');
  var gutil = require('gulp-util');
  var lintSrc = ['./gulpfile.js', './index.js', './lib/**/*.js', 'test/**/*.js', 'bin/*.js'];
  var testSrc = ['test/*helper.js', 'test/*spec.js'];

  function runCoverage (opts) {
    return gulp.src(testSrc, { read: false })
      .pipe($.coverage.instrument({
        pattern: ['./lib/**/*.js'],
        debugDirectory: 'debug'}))
      .pipe($.plumber())
      .pipe($.mocha({reporter: 'spec'})
            .on('error', function (err) { gutil.log("test error: " + err); this.emit('end'); })) // test errors dropped
      .pipe($.plumber.stop())
      .pipe($.coverage.gather())
      .pipe($.coverage.format(opts));
  }

  gulp.task("clean", function (done) {
    del(["coverage/**/*", "coverage", "debug/**/*", "debug"], done);
  });

  gulp.task("lint", function () {
    return gulp.src(lintSrc)
      .pipe($.jshint())
      .pipe($.jshint.reporter());
  });

  gulp.task('test', ['lint'], function () {
    return gulp.src(testSrc, {read: false})
      .pipe($.plumber())
      .pipe($.mocha({reporter: 'spec'}).on('error', function (err) { console.log("test error: " + err); this.emit('end'); })) // test errors dropped
      .pipe($.plumber.stop());
  });
  gulp.task('coveralls', ['lint'], function () {
    return runCoverage({reporter: 'lcov'})
      .pipe($.coveralls());
  });
  gulp.task('coverage', ['lint'], function () {
    return runCoverage({outFile: './index.html'})
      .pipe(gulp.dest('coverage'));
  });
  gulp.task('watch', function () {
    gulp.watch([lintSrc], ['test']);
  });

  gulp.task("default", ['test', "watch"]);
})();
