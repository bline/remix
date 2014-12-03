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
  var pkg = require("./package.json");
  var exec = require("child_process").exec;
  var files = {
    lib: ['./lib/**/*.js'],
    lint: ['./gulpfile.js', './index.js', './lib/**/*.js', 'test/**/*.js', 'bin/*.js'],
    test: ['test/*helper.js', 'test/*spec.js']
  };
  var options = {
    jsdoc: {
      cmd: [
        'jsdoc',
        '--configure ./config/jsdoc.json',
        '--verbose',
        '--pedantic',
        '--readme ./README.md',
        '--package ./package.json',
        '--destination ./docs'
      ]
    }
  };

  function runCoverage (opts) {
    return gulp.src(files.test, { read: false })
      .pipe($.coverage.instrument({
        pattern: files.lib,
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
    return gulp.src(files.lint)
      .pipe($.jshint())
      .pipe($.jshint.reporter());
  });

  gulp.task('test', ['lint'], function () {
    return gulp.src(files.test, {read: false})
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
  gulp.task('docs', function (done) {
    exec(options.jsdoc.cmd.join(' '), function (err, stdout, stderr) {
      gutil.log(stdout);
      gutil.log(stderr);
      done(err);
    });
  });
  gulp.task('watch', function () {
    gulp.watch(files.lint, ['test']);
  });

  gulp.task("default", ['test', "watch"]);
})();
