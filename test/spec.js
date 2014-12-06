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
        var str = 'fooofooofoooBarrfoooBarrfoooBarr';
        this.re.add(/(foo)o/, /(bar)r/i);
        this.re.compile().should.deep.equal([/((foo)o)/g, /((bar)r)/ig]);
        this.re.exec(str).should.deep.equal([['fooo', 'foo'], '', 0, 4]);
        this.re.exec(str).should.deep.equal([['fooo', 'foo'], '', 0, 8]);
        this.re.exec(str).should.deep.equal([['fooo', 'foo'], '', 0, 12]);
        this.re.exec(str).should.deep.equal([['Barr', 'Bar'], '', 1, 16]);
        this.re.exec(str).should.deep.equal([['fooo', 'foo'], '', 0, 20]);
        this.re.exec(str).should.deep.equal([['Barr', 'Bar'], '', 1, 24]);
        this.re.exec(str).should.deep.equal([['fooo', 'foo'], '', 0, 28]);
        this.re.exec(str).should.deep.equal([['Barr', 'Bar'], '', 1, 32]);
        this.re.exec(str).should.deep.equal(false);
      });
      it("should not combine mutiline", function () {
        this.re.add(/foo/, /bar/m).compile().should.deep.equal([/(foo)/g, /(bar)/mg]);
      });
      it("should add named", function () {
        this.re.addNamed('foo', /foo/).compile().should.deep.equal([/(foo)/g]);
      });
      it("should allow ReMix~Pairs", function () {
        this.re.add({foo: {bar: /bar/}, baz: /baz/});
        var str = "barbazbarbaz";
        this.re.exec(str).should.deep.equal([['bar'], 'foo.bar', 0, 3]);
        this.re.exec(str).should.deep.equal([['baz'], 'baz', 1, 6]);
        this.re.exec(str).should.deep.equal([['bar'], 'foo.bar', 0, 9]);
        this.re.exec(str).should.deep.equal([['baz'], 'baz', 1, 12]);
        this.re.exec(str).should.deep.equal(false);
      });
      it("should return named match", function () {
        var str = 'foo';
        this.re.add({name: 'foo.foo', spec: /foo/});
        this.re.exec(str).should.deep.equal([['foo'], 'foo.foo', 0, 3]);
      });
      it("should allow nested delimited", function () {
        var a1 = new lib.ReMix('a1'),
            a2 = new lib.ReMix('a2'),
            str = "foobar";

        a1.options({nsDelimiter: '/'});
        a1.add({foo: /foo/});
        a2.add({bar: /bar/});

        a1.add(a2);

        a1.exec(str).should.deep.equal([['foo'], 'a1/foo',    0, 3]);
        a1.exec(str).should.deep.equal([['bar'], 'a1/a2/bar', 1, 6]);
        a1.exec(str).should.equal(false);
      });
      it("should not match", function () {
        this.re.add(/foo/).exec('bar').should.equal(false);
      });
      it("should allow named regex", function () {
        var str = 'foobar';
        this.re.add({name: "foo", spec: new lib.ReMix(/foo/, /bar/)});
        this.re.exec(str).should.deep.equal([['foo'], 'foo', 0, 3]);
        this.re.exec(str).should.deep.equal([['bar'], 'foo', 1, 6]);
      });
    });
  });
})();