/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  var _ = require("lodash");
  function genguid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }
  function ReMix(namespace) {
    var args = _.flatten(_.toArray(arguments));
    if (_.isString(namespace) || _.isNull(namespace) || _.isUndefined(namespace))
      args = args.slice(1);
    else
      namespace = undefined;
    this._id           = genguid();
    this._opt          = {};
    this._specs        = [];
    this._matches      = [];
    this._namespace    = namespace;
    this._namestack    = [];
    if (namespace)
      this._namestack.push(namespace);
    _.merge(this._opt, ReMix.defaultOptions);
    if (args.length)
      this.add(args);
  }
  ReMix.registered = {
    hspace:          /[ \t\u00a0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000]/,
    noHspace:        /[^ \t\u00a0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000]/,
    vspace:          /[\v\n\r\f]/,
    number:          /0b[01]+|0o[0-7]+|0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?/,
    noVspace:        /[^\v\n\r\f]/,
    space:           /\s/,
    noSpace:         /\S/,
    word:            /\w/,
    noWord:          /\W/,
    any:             /[\S\s]/,
    eol:             /(?:\r\n?|\n|\f)/,
    notEol:          /[^\r\n\f]/,
    end:             /$/,
    begin:           /^/,
    cMultiComment:   /\/\*[^*]*\*+(?:[^\/*][^*]*\*+)*\//
  };
  ReMix.RE = {
    variable: /^(\w+)([+*?])?$/,
    templates: /\\(?:\\\\)*{|{\s*(\w+[+*?]?)\s*}/g,
    countParen: /(?:\\(?:\\\\)*\()|(\((?!\?))/g
  };
  ReMix.defaultOptions = {
    nsDelimiter: '.',
    defaultFlags: 'g'
  };
  ReMix._countParens = function (str) {
    var cnt = 0, match;
    while ((match = ReMix.RE.countParen.exec(str)))
      if (match[1])
        cnt++;
    return cnt;
  };
  ReMix._resolveVariable = function (match, key) {
    var mod = '';
    if (!key)
      return match;
    var varMatch = ReMix.RE.variable.exec(key);
    if (varMatch) {
      key = varMatch[1] || key;
      mod = varMatch[2] || '';
    }
    return (ReMix.registered[key] ?
      '(?:' + ReMix.registered[key].source + ')' :
        key) + mod;
  };
  ReMix._resolveTemplate = function (str) {
      str = ReMix._resolveVariable(str, str);
      str = str.replace(ReMix.RE.templates, ReMix._resolveVariable);
      return new RegExp(str);
  };

  ReMix.register = function (identifier) {
    if (!_.isString(identifier)) {
      _.forEach(identifier, function(val, key) {
          if (!_.isString(key))
            throw new Error("invalid identifier for registerMatch '" + identifier + "'");
          ReMix.register(key, val);
      });
      return ReMix;
    }
    if (_.has(ReMix.registered, identifier))
      throw new Error(identifier + " already in use");

    ReMix.registered[identifier] = ReMix.render.apply(ReMix, _.toArray(arguments).slice(1));

    return ReMix;
  };
  ReMix.getRegistered = function (identifier) {
    return ReMix.registered[identifier];
  };
  ReMix.prototype._canJoin = function (re1, re2) {
    return (
      (this._flags.i || re1.ignoreCase === re2.ignoreCase) &&
      (this._flags.m ||  re1.multiline === re2.multiline)  &&
      (this._flags.g ||     re1.global === re2.global));
  };
  ReMix.prototype._join = function (regexn) {
    var src = regexn.map(function (re) {
      return re.source;
    }).join(')|(');
    src = '(' + src + ')';
    var flags = '';
    if (regexn[0].ignoreCase && !this._flags.i) flags += 'i';
    if (regexn[0].multiline  && !this._flags.m) flags += 'm';
    if (regexn[0].global     && !this._flags.g) flags += 'g';
    flags += this._opt.defaultFlags;
    return new RegExp(src, flags);
  };
  ReMix.prototype.options = function (opt) {
    if (opt) _.merge(this._opt, opt);
    var flags = this._flags = {};
    _.forEach(this._opt.defaultFlags, function (c) {
      flags[c] = true;
    });
    return this.opt;
  };
  ReMix.prototype._resolveNamed = function (namespace, spec) {
    this._namestack.push(namespace);
    spec = this._resolveSpec(spec);
    this._namestack.pop();
    return spec;
  };
  ReMix.prototype._resolveSpec = function (spec) {
    var namespace = this._namestack.join(this._opt.nsDelimiter);
    if (_.isRegExp(spec)) {
      spec[this._id] = namespace;
      return spec;
    } else if (spec instanceof ReMix) {
      if (spec._namespace) {
        return this._resolveNamed(spec._namespace, spec._specs);
      } else {
        return this._resolveSpec(spec._specs);
      }
    } else  if (_.isString(spec))
      return this._resolveSpec(ReMix._resolveTemplate(spec));
    else if (_.has(spec, 'name') && _.has(spec, 're'))
      return this._resolveNamed(_.result(spec, 'name'), _.result(spec, 're'));
    else if (_.isArray(spec))
      return spec.map(this._resolveSpec.bind(this));
    else if (_.isFunction(spec))
      return this._resolveSpec(spec.call(this, namespace));
    else
      return _.map(spec, function (value, key) {
        return this._resolveNamed(key, _.result(spec, key));
      }.bind(this));
  };
  ReMix.prototype.namespace = function (namespace) {
    if (namespace) {
      this._namespace = namespace;
      this._namestack = [namespace];
      if (this._regexn)
        this._regexn = null;
    }
    return this._namespace;
  };
  ReMix.prototype.clear = function () {
    this._specs = [];
    if (this._regexn)
      this._regexn = null;
    return this;
  };
  ReMix.prototype.add = function () {
    this._specs = this._specs.concat(_.flatten(arguments));
    if (this._regexn)
      this._regexn = null;
    return this;
  };
  ReMix.prototype.addNamed = function (name) {
    var args = _.flatten(arguments).slice(1);
    return this.add({re: args, name: name});
  };
  ReMix.prototype.hasSpecs = function () {
    return this._specs.length > 0;
  };
  ReMix.prototype.compile = function (force) {
    if (!force && this._regexn) return this._regexn;
    var matches = this._matches = [], id = this._id, that = this;
    this._regexn = _.reduce(_.flatten(this._resolveSpec(this._specs)), function (regexn, re, idx) {
      var last = _.last(regexn),
        lastMatch = _.last(matches),
        namespace = re[id],
        parenCnt = ReMix._countParens(re.source);
      if (last && that._canJoin(last[0], re)) {
        lastMatch.push([namespace, parenCnt, idx]);
        last.push(re);
      } else {
        matches.push([[namespace, parenCnt, idx]]);
        regexn.push([re]);
      }
      return regexn;
    }, []).map(function (set) {
      return that._join(set);
    });
    return this._regexn;
  };
  ReMix.prototype.setLastIndex = function (index) {
    this.compile();
    this._regexn.forEach(function (regex) {
      regex.lastIndex = index;
    });
    return this;
  };
  ReMix.prototype.exec = function (string) {
    this.compile();
    var regexn = this._regexn,
      startRe = string[this._id] || 0,
      found = false,
      that = this;
    _.forEach(regexn.slice(startRe), function(re, i) {
      var match = re.exec(string);
      if (match) {
        _.forEach(that._resolveMatch(match, i), function (res) {
          if (_.some(res[0], _.isString)) {
            found = res.concat(re.lastIndex);
            return false;
          }
        });
        if (found) {
          string[that._id] = i;
          return false;
        }
      }
    });

    if (!found)
      delete string[this._id];
    return found;
  };

  ReMix.prototype._resolveMatch = function (matches, index) {

    matches.shift(); // full match
    var lastSet = _.last(this._matches[index]);
    if (matches.length < lastSet[1] + 1)
      _.times(lastSet[1] + 1 - matches.length, function () { matches.push(undefined); });
    return this._matches[index].map(function (set, idx) {
      /*var namespace = set[0],
        cnt = set[1],
        idx = set[2],
        match = matches.splice(0, cnt + 1);
      return [match, namespace, idx];*/
      return [matches.splice(0, set[1] + 1), set[0], set[2]];
    });
  };
  ReMix.prototype.toString = function () {
    return this.compile().map(function (re) {
      return re.source;
    }).join('|');
  };
  module.exports = ReMix;
})();