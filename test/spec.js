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
    describe("remix", function () {
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
        this.re.add(re).compile().should.deep.equal([new RegExp('(' + re.source + ')', 'g')]);
      });
      it("should compile multiple regexn", function () {
        this.re.add(/foo/, /bar/).compile().should.deep.equal([/(foo)|(bar)/g]);
      });
      it("should match simple", function () {
        this.re.add(/(foo)o/).exec('fooo').should.deep.equal([['fooo', 'foo'], '',  0, 4]);
      });
      it("should match multiple", function () {
        var str = 'foobar';
        this.re.add(/(foo)/, /bar/);
        this.re.exec(str).should.deep.equal([['foo', 'foo'], '', 0, 3]);
        this.re.exec(str).should.deep.equal([['bar'], '', 1, 6]);
        this.re._regexn.should.deep.equal([/((foo))|(bar)/g]);
      });
      it("should match multiple sets", function () {
        var str = 'foooBarr';
        this.re.add(/(foo)o/, /(bar)r/i);
        this.re.compile().should.deep.equal([/((foo)o)/g, /((bar)r)/ig]);
        this.re.exec(str).should.deep.equal([['fooo', 'foo'], '', 0, 4]);
        this.re.exec(str).should.deep.equal([['Barr', 'Bar'], '', 1, 8]);
      });
      it("should not combine mutiline", function () {
        this.re.add(/foo/, /bar/m).compile().should.deep.equal([/(foo)/g, /(bar)/mg]);
      });
      it("should add named", function () {
        this.re.addNamed('foo', /foo/).compile().should.deep.equal([/(foo)/g]);
      });
      it("should return named match", function () {
        var str = 'foo';
        this.re.add({name: 'foo.foo', re: /foo/});
        this.re.exec(str).should.deep.equal([['foo'], 'foo.foo', 0, 3]);
      });
      it("should not match", function () {
        this.re.add(/foo/).exec('bar').should.equal(false);
      });
      it("should allow named regex", function () {
        var str = 'foobar';
        this.re.add({name: "foo", re: new lib.ReMix(/foo/, /bar/)});
        this.re.exec(str).should.deep.equal([['foo'], 'foo', 0, 3]);
        this.re.exec(str).should.deep.equal([['bar'], 'foo', 1, 6]);
      });
    });
  });
})();