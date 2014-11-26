/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  var _ = require("lodash"),
    ReSpec = require('./respec.js')(Re),
    EventEmitter2 = require('eventemitter2').EventEmitter2,
    util = require("util");
  Re.registered = {
    hspace:          /[ \t\u00a0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000]/,
    noHspace:        /[^ \t\u00a0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000]/,
    vspace:          /[\v\n\r\f]/,
    number:          /0b[01]+|0o[0-7]+|0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?/,
    noVspace:        /[^\v\n\r\f]/,
    space:           /\s/,
    noSpace:         /\S/,
    word:            /\w/,
    noWord:          /\W/,
    eol:             /(?:\r\n?|\n|\f)/,
    notEol:          /[^\r\n\f]/,
    end:             /$/,
    begin:           /^/,
    cMultiComment:   /\/\*[^*]*\*+(?:[^\/*][^*]*\*+)*\//
  };
  /** Represents a Regular Matching Spec.
   * Makes it possible to join multiple regular expressions
   * together to form a single match.
   *
   *  var re = new
   *
   *  var re = new Re('foo', /foo/, /bar/)
   *  var re = new Re('foo', {foo: /foo/, bar: /bar/});
   *  var re = new Re('foo', [/foo/, /bar/]);
   *
   *  var re = new Re({foo: /foo/, bar: /bar/});
   *  var re = new Re([/foo/, /bar/]);
   *  var re = new Re([/foo/, /bar/]);
   */
  Re.defaultOptions = {
    eventEmitter: {
      wildcard: true,
      maxListeners: 100
    }
  };
  function genguid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }
  function Re(namespace) {
    this.opt = _.clone(Re.defaultOptions);
    var args = _.toArray(arguments);
    this._id = genguid();

    if (_.isString(namespace) || _.isNull(namespace) || _.isUndefined(namespace))
      args = args.slice(1);
    else
      namespace = undefined;

    EventEmitter2.call(this, this.opt.eventEmitter);
    this._spec = new Re.Spec(namespace, args);
    this._regexn = null;
    this.lastMatch = 0;
  }
  Re.Spec = ReSpec;
  util.inherits(Re, EventEmitter2);
  Re.register = function (identifier) {
    if (!_.isString(identifier)) {
      _.forEach(identifier, function(val, key) {
          if (!_.isString(key))
            throw new Error("invalid identifier for registerMatch '" + identifier + "'");
          Re.register(key, val);
      });
      return Re;
    }
    if (_.has(Re.registered, identifier))
      throw new Error(identifier + " already in use");

    Re.registered[identifier] = Re.render.apply(Re, _.toArray(arguments).slice(1));

    return Re;
  };
  Re.getRegistered = function (identifier) {
    return Re.registered[identifier];
  };
  Re.canJoin = function (re1, re2) {
    return re1.ignoreCase === re2.ignoreCase && re1.multiline === re2.multiline;
  };
  Re.join = function (regexn) {
    var src = regexn.map(function (re) {
      return re.source;
    }).join(')|(');
    src = '(' + src + ')';
    var flags = '';
    if (regexn[0].ignoreCase) flags += 'i';
    if (regexn[0].multiline) flags += 'm';
    flags += 'g';
    return new RegExp(src, flags);
  };
  Re.prototype.namespace = function (namespace) {
    if (namespace) {
      this._namespace = namespace;
      if (this._regexn)
        this.compile(true);
    }
    return this._namespace;
  };
  Re.prototype.compile = function (force) {
    if (!force && this._regexn) return this._regexn;
    this._regexn = this._spec.compile();
    return this;
  };
  Re.prototype.add = function () {
    this._spec.add(_.toArray(arguments));
    return this;
  };
  Re.prototype.addNamed = function (name) {
    var args = _.toArray(arguments).slice(1);
    this._spec.add({name: name, re: args});
    return this;
  };
  Re.prototype.hasSpecs = function () {
    return this._spec.hasSpecs();
  };
  Re.prototype.exec = function (string) {
    this.compile();
    var regexn = this._regexn,
      startRe = string[this._id] || 0,
      matches = [], found = false,
      that = this, resolveMatch;
    resolveMatch = function (match, i, lastIndex, noMatch) {
      that._spec.resolveMatch(match, i).forEach(function (res) {
        res[1] = res[1].concat(lastIndex);
        if (res[0] && _.some(res[1], _.isString)) {
          that.emit(res[0], res[0], res[1]);
        }
        matches.push(res[1]);
      });
    };
    _.forEach(regexn, function(re, i) {
      if (i < startRe || found) {
        resolveMatch([undefined], i, 0, true);
        return;
      }
      var match = re.exec(string);
      if (match) {
        string[that._id] = i;
        resolveMatch(match, i, re.lastIndex);
        found = true;
      } else {
        resolveMatch([undefined], i, 0, true);
      }
    });

    if (!found)
      delete string[this._id];
    return found ? matches : false;
  };
  Re.prototype.test = function (string) {
    this.compile();
    var regexn = this._regexn,
      startRe = this.lastMatch,
      match = false, that = this;
    _.forEach(regexn.slice(startRe), function(re, i) {
       match = re.test(string);
       if (match) that.lastMatch = i;
       return !match;
    });
    return match;
  };
  Re.prototype.reject = function (string) {
    if (!this._regexn)
      throw new Error('reject on non-compiled regexp');
    var lastRe = this._regexn[string[this._id] || 0];
    lastRe.lastIndex = 0;
    if (string[this._id]) {
      string[this._id]--;
      this._regexn[string[this._id]].lastIndex = 0;
    }
    return this;
  };
  Re.prototype.toString = function () {
    return this.compile()._regexn.map(function (re) {
      return re.source;
    }).join('|');
  };


  module.exports = Re;
})();