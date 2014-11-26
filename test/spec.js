/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
/* jshint undef: true, unused: true */
/* global describe:false, it: false, beforeEach: false, expect: false */
(function () {
  'use strict';
  var libPath = '../index.js';
  describe("remix#exports", function () {
    it("should load without throwing errors", function () {
      (function () {
        require(libPath);
      })
      .should.not.throw();
    });
    it("should export correctly", function () {
      var lib = require(libPath);
      lib.remix.should.be.a('function');
      lib.ReMix.should.be.a('function');
    });
    describe("rematch#Re", function () {
      var lib = require(libPath);
      beforeEach(function () {
        this.re = new lib.ReMix();
      });
      it("should instantiate", function () {
        this.re.should.be.instanceof(lib.ReMix);
      });
      it("should accept regexp object", function () {
        var re = /foo/;
        this.re = new lib.ReMix(re);
        expect(this.re.toString()).to.equal('(foo)');
      });
      it("should accept string", function () {
        var str = 'foo';
        this.re = new lib.ReMix(null, str);
        expect(this.re.toString()).to.equal('(foo)');
      });
      it("should accept array", function () {
        var arr = ['foo', 'bar'];
        this.re = new lib.ReMix(null, arr);
        expect(this.re.toString()).to.equal('(foo)|(bar)');
      });
      it("should compile simple regexp", function () {
        var re = /foo/;
        this.re.add(re).compile()._regexn.should.deep.equal([new RegExp('(' + re.source + ')', 'g')]);
      });
      it("should compile multiple regexn", function () {
        this.re.add(/foo/, /bar/).compile()._regexn.should.deep.equal([/(foo)|(bar)/g]);
      });
      it("should match simple", function () {
        this.re.add(/(foo)o/).exec('fooo').should.deep.equal([['fooo', 'foo'], 4]);
      });
      it("should match multiple", function () {
        var str = 'foobar';
        this.re.add(/(foo)/, /bar/);
        this.re.exec(str).should.deep.equal([['foo', 'foo'], [undefined], 3]);
        this.re.exec(str).should.deep.equal([[undefined, undefined], ['bar'], 6]);
        this.re._regexn.should.deep.equal([/((foo))|(bar)/g]);
      });
      it("should match multiple sets", function () {
        var str = 'foooBarr';
        this.re.add(/(foo)o/, /(bar)r/i);
        this.re.exec(str).should.deep.equal([['fooo', 'foo'], [undefined, undefined], 4]);
        this.re.exec(str).should.deep.equal([[undefined, undefined], ['Barr', 'Bar'], 8]);
        this.re._regexn.should.deep.equal([/((foo)o)/g, /((bar)r)/ig]);
      });
      it("should not combine mutiline", function () {
        this.re.add(/foo/, /bar/m).compile()._regexn.should.deep.equal([/(foo)/g, /(bar)/mg]);
      });
      it("should add named", function () {
        this.re.addNamed('foo', /foo/).compile()._regexn.should.deep.equal([/(foo)/g]);
      });
      it("should emit named match", function (done) {
        var str = 'foo';
        this.re.add({name: 'foo.foo', re: /foo/});
        this.re.on('foo.*', function (name, match) {
          name.should.equal('foo.foo');
          match.should.deep.equal(['foo', 3]);
          done();
        });
        this.re.exec(str);
      });
      it("should not match", function () {
        this.re.add(/foo/).exec('bar').should.equal(false);
      });
      it("should test", function () {
        this.re.add(/foo/).test('foo').should.equal(true);
        this.re.test('bar').should.equal(false);
        this.re.test('foo').should.equal(true);
        this.re.test('bar').should.equal(false);
        this.re.test('bar').should.equal(false);
        this.re.test('foo').should.equal(true);
        this.re.test('bar').should.equal(false);
        this.re.test('bar').should.equal(false);
      });
      it("should restart on reject", function () {
        var str = 'foobarfoo';
        this.re.add(/(foo)/);
        this.re.exec(str).should.deep.equal([['foo', 'foo'], 3]);
        this.re.reject(str);
        this.re.exec(str).should.deep.equal([['foo', 'foo'], 3]);
        this.re.exec(str).should.deep.equal([['foo', 'foo'], 9]);
      });
      it("should reject length", function () {
        var str = "fooooobarrrrrr";
        this.re.add(/(ooo|rrr)/);
        this.re.exec(str).should.deep.equal([['ooo', 'ooo'], 4]);
        this.re.exec(str).should.deep.equal([['rrr', 'rrr'], 11]);
        this.re.reject(str);
        this.re.exec(str).should.deep.equal([['ooo', 'ooo'], 4]);
      });
      it("should reject multi", function () {
        var str = "fooooobarrrrrr";
        this.re.add(/(ooo)/, /rrr/);
        this.re.exec(str).should.deep.equal([['ooo', 'ooo'], [undefined], 4]);
        this.re.reject(str);
        this.re.exec(str).should.deep.equal([['ooo', 'ooo'], [undefined], 4]);
        this.re.exec(str).should.deep.equal([[undefined, undefined],['rrr'], 11]);
        this.re.reject(str);
        this.re.exec(str).should.deep.equal([['ooo', 'ooo'], [undefined], 4]);
      });
      it("should reject multi no-join", function () {
        var str = "fooooobarrrrrr";
        this.re.add(/ooo/, /rrr/i);
        this.re.exec(str).should.deep.equal([['ooo'], [undefined], 4]);
        this.re.reject(str);
        this.re.exec(str).should.deep.equal([['ooo'], [undefined], 4]);
        this.re.exec(str).should.deep.equal([[undefined], ['rrr'], 11]);
        this.re.reject(str);
        this.re.exec(str).should.deep.equal([['ooo'], [undefined], 4]);
      });
      it("should allow named regex", function (done) {
        var str = 'foobar', cnt = 0;
        this.re.add({name: "foo", re: new lib.ReMix(/foo/, /bar/)});
        this.re.on('foo', function (name, match) {
          name.should.equal("foo");
          cnt++;
          if (cnt === 1) {
            match.should.deep.equal(['foo', 3]);
          } else {
            match.should.deep.equal(['bar', 6]);
            done();
          }
        });
        this.re.exec(str);
        this.re.exec(str);
      });
    });
  });
})();