/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  var _ = require("lodash");
  module.exports = function (ReMix) {
    function ReSpec(namespace) {
      var args = _.flatten(_.toArray(arguments));
      if (_.isString(namespace) || _.isNull(namespace) || _.isUndefined(namespace))
        args = args.slice(1);
      else
        namespace = undefined;
      this._specs = [];
      this._matches = [];
      this._namedMatches = [];
      this._namespace = namespace;
      this._namestack = [];
      if (namespace)
        this._namestack.push(namespace);
      if (args.length)
        this.add(args);
    }
    ReSpec.RE = {
      variable: /^(\w+)([+*?])?$/,
      templates: /(?:\\(?:\\\\)*`)|`\s*(\w+[+*?]?)\s*`/g,
      countParen: /(?:\\(?:\\\\)*\()|(\((?!\?))/g
    };
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
    ReSpec.prototype.resolveNamed = function (namespace, spec) {
      this._namestack.push(namespace);
      spec = this.resolveSpec(spec);
      this._namestack.pop();
      return spec;
    };
    ReSpec.prototype.resolveSpec = function (spec) {
      var namespace = this._namestack.join('.');
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
      else
        return _.map(spec, function (value, key) {
          return this.resolveNamed(key, _.result(spec, key));
        }.bind(this));
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
          lastMatch.push([namespace, parenCnt]);
          last.push(re);
        } else {
          matches.push([[namespace, parenCnt]]);
          regexn.push([re]);
        }
        return regexn;
      }, []).map(function (set) {
        return ReMix.join(set);
      });
      return this._regexn;
    };
    ReSpec.prototype.resolveMatch = function (matches, index) {

      matches.shift(); // full match

      var lastSet = _.last(this._matches[index]);
      if (matches.length < lastSet[1] + 1)
        _.times(lastSet[1] + 1 - matches.length, function () { matches.push(undefined); });
      return this._matches[index].map(function (set, idx) {
        /*var namespace = set[0],
          cnt = set[1],
          match = matches.splice(0, cnt + 1);
        return [namespace, match];*/
        return [set[0], matches.splice(0, set[1] + 1)];
      });
    };
    return ReSpec;
  };
})();