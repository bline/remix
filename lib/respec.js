/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  /* XXX redo as mixin */
  'use strict';
  var _ = require("lodash");
  module.exports = function (ReMix) {
    function ReSpec(namespace) {
      var args = _.flatten(_.toArray(arguments));
      if (_.isString(namespace) || _.isNull(namespace) || _.isUndefined(namespace))
        args = args.slice(1);
      else
        namespace = undefined;
      this._opt          = {};
      this._specs        = [];
      this._matches      = [];
      this._namespace    = namespace;
      this._namestack    = [];
      if (namespace)
        this._namestack.push(namespace);
      _.merge(this._opt, ReSpec.defaultOptions);
      if (args.length)
        this.add(args);
    }
    ReSpec.RE = {
      variable: /^(\w+)([+*?])?$/,
      templates: /\\(?:\\\\)*{|{\s*(\w+[+*?]?)\s*}/g,
      countParen: /(?:\\(?:\\\\)*\()|(\((?!\?))/g
    };
    ReSpec.defaultOptions = ReMix.defaultOptions;
    ReSpec.countParens = function (str) {
      var cnt = 0, match;
      while ((match = ReSpec.RE.countParen.exec(str)))
        if (match[1])
          cnt++;
      return cnt;
    };
    ReSpec.resolveVariable = function (match, key) {
      var mod = '';
      if (!key)
        return match;
      var varMatch = ReSpec.RE.variable.exec(key);
      if (varMatch) {
        key = varMatch[1] || key;
        mod = varMatch[2] || '';
      }
      return (ReMix.registered[key] ?
        '(?:' + ReMix.registered[key].source + ')' :
          key) + mod;
    };
    ReSpec.resolveTemplate = function (str) {
        str = ReSpec.resolveVariable(str, str);
        str = str.replace(ReSpec.RE.templates, ReSpec.resolveVariable);
        return new RegExp(str);
    };
    ReSpec.prototype.options = function (opt) {
      if (opt) _.merge(this._opt, opt);
      return this.opt;
    };
    ReSpec.prototype.resolveNamed = function (namespace, spec) {
      this._namestack.push(namespace);
      spec = this.resolveSpec(spec);
      this._namestack.pop();
      return spec;
    };
    ReSpec.prototype.resolveSpec = function (spec) {
      var namespace = this._namestack.join(this._opt.nsDelimiter);
      if (_.isRegExp(spec)) {
        spec.__respec__namespace__ = namespace;
        return spec;
      } else if (spec instanceof ReSpec)
        if (spec._namespace)
          return this.resolveNamed(spec._namespace, spec._specs);
        else
          return this.resolveSpec(spec._specs);
      else if (spec instanceof ReMix)
        return this.resolveSpec(spec._spec);
      else if (_.isString(spec))
        return this.resolveSpec(ReSpec.resolveTemplate(spec));
      else if (_.has(spec, 'name') && _.has(spec, 're'))
        return this.resolveNamed(_.result(spec, 'name'), _.result(spec, 're'));
      else if (_.isArray(spec))
        return spec.map(this.resolveSpec.bind(this));
      else if (_.isFunction(spec))
        return this.resolveSpec(spec.call(this, namespace));
      else
        return _.map(spec, function (value, key) {
          return this.resolveNamed(key, _.result(spec, key));
        }.bind(this));
    };
    ReSpec.prototype.namespace = function (namespace) {
      if (namespace) {
        this._namespace = namespace;
        this._namestack = [namespace];
        if (this._regexn)
          this.compile(true);
      }
      return this._namespace;
    };
    ReSpec.prototype.add = function (specs) {
      this._specs = this._specs.concat(_.flatten(this.resolveSpec(specs)));
      return this;
    };
    ReSpec.prototype.hasSpecs = function () {
      return this._specs.length > 0;
    };
    ReSpec.prototype.compile = function (force) {
      if (!force && this._regexn) return this._regexn;
      var matches = this._matches = [];
      this._regexn = _.reduce(this._specs, function (regexn, re, idx) {
        var last = _.last(regexn),
          lastMatch = _.last(matches),
          namespace = re.__respec__namespace__,
          parenCnt = ReSpec.countParens(re.source);
        if (last && ReMix.canJoin(last[0], re)) {
          lastMatch.push([namespace, parenCnt, idx]);
          last.push(re);
        } else {
          matches.push([[namespace, parenCnt, idx]]);
          regexn.push([re]);
        }
        return regexn;
      }, []).map(function (set) {
        return ReMix.join(set);
      });
      return this._regexn;
    };
    ReSpec.prototype.setLastIndex = function (index) {
      this.compile();
      this._regexn.forEach(function (regex) {
        regex.lastIndex = index;
      })
      return this;
    };
    ReSpec.prototype.resolveMatch = function (matches, index) {

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
    return ReSpec;
  };
})();