/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  var _ = require("lodash");
  /**
   * A simple GUID function for object ids
   * @private
   * @returns {String} Generated Globally Unique ID
   */
  function genguid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }
  /**
   * Construct a new `ReMix` object.
   *
   * The namespace sets this ReMix's namespace. The namespace is used when
   * returning matches. All sub-child named matches will be prefixed with
   * their parent's namespace follow by `nsDelimiter`. If namespace is null
   * or not specified, no prefix will be given to named child matches.
   *
   * Any arguments after `namespace` are passed to [ReMix.add]
   * @constructor
   * @param {ReMix~namespace} [namespace] - The namespace for this ReMix object.
   * @param {ReMix~Spec} spec - Specification for this ReMix object.
   */
  function ReMix(namespace) {
    var args = _.flatten(_.toArray(arguments));
    if (_.isString(namespace) || _.isNull(namespace) || _.isUndefined(namespace))
      args = args.slice(1);
    else
      namespace = undefined;
    /** Unique id used for storing data in RegExp objects */
    this._id           = genguid();
    /** Current instance options */
    this._opt          = {};
    /** Stores current unresolved specification */
    this._specs        = [];
    /** Tracking data for relating namespace to match index */
    this._matches      = [];
    /** This ReMix's namespace */
    this._namespace    = namespace;
    /** Used when composing ReMix objects or named RegExp objects. {@link ReMix#scope} */
    this._namestack    = [];
    if (namespace)
      this._namestack.push(namespace);
    this.options(ReMix.defaultOptions);
    if (args.length)
      this.add(args);
  }
  /** Default registered templates */
  ReMix.registered = {
    /** Horizontal space, including unicode horizontal space code points */
    hspace:          /[ \t\u00a0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000]/,
    /** hspace negated */
    noHspace:        /[^ \t\u00a0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000]/,
    /** Vertical space character class */
    vspace:          /[\v\n\r\f]/,
    /** General number match, includes all Javascript supported number formated */
    number:          /0b[01]+|0o[0-7]+|0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?/,
    /** Negated vspace character class */
    noVspace:        /[^\v\n\r\f]/,
    /** SPACE */
    space:           /\s/,
    /** NOSPACE */
    noSpace:         /\S/,
    /* WORD */
    word:            /\w/,
    /* NOWORD */
    noWord:          /\W/,
    /* Match any one character, doesn't depend on RegExp flags */
    any:             /[\S\s]/,
    /* Match EOL on any platform */
    eol:             /(?:\r\n?|\n|\f)/,
    /* Not EOL character class */
    notEol:          /[^\r\n\f]/,
    /* END of string or line depending on RegExp flags */
    end:             /$/,
    /* Beginning of line or string depending on RegExp flags */
    begin:           /^/,
    /* TODO REMOVE */
    cMultiComment:   /\/\*[^*]*\*+(?:[^\/*][^*]*\*+)*\//
  };
  /**
   * Internally used regular expressions */
  ReMix.RE = {
    /** For matching variable with possible modifier */
    variable: /^(\w+)([+*?])?$/,
    /** For extracting variables from templates */
    templates: /\\(?:\\\\)*{|{\s*(\w+[+*?]?)\s*}/g,
    /** For counting left parens to figure out how many matches a given RegExp will produce, for joining. */
    countParen: /(?:\\(?:\\\\)*\()|(\((?!\?))/g
  };
  /**
   * Default options. Changing these affects all future objects.
   * @type {ReMix~Options}
   */
  ReMix.defaultOptions = {
    nsDelimiter: '.',
    defaultFlags: 'g'
  };
  /**
   * Counts left parens for figuring out match indexes when joining regular
   * expressions.
   * @private
   * @param {string} regexp - source of regular expression to count parans on
   * @returns {number} parens - number of left non-escaped parentheses */
  ReMix._countParens = function (str) {
    var cnt = 0, match;
    while ((match = ReMix.RE.countParen.exec(str)))
      if (match[1])
        cnt++;
    return cnt;
  };
  /**
   * Resolves extracted variables with modifieres.
   * @private
   * @param {string} match - Full template match (unused).
   * @param {string} key - The key/modifier match to resolve.
   * @returns {string} regexp - generated regexp from variable or the variable it's self if no registered matches were found.
   */
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
  /**
   * Resolves a template string to a RegExp object.
   * @private
   * @param {ReMix~template}
   * @returns {RegExp}
   */
  ReMix._resolveTemplate = function (str) {
      str = ReMix._resolveVariable(str, str);
      str = str.replace(ReMix.RE.templates, ReMix._resolveVariable);
      return new RegExp(str);
  };
  /**
   * @typedef {(RegExp|ReMix~template)} ReMix~RegisterMatchSpec
   * @typedef {Object.<string, ReMix~RegisterMatchSpec>} ReMix~RegisterMatchObject
   */
  /**
   * Register a new match template variable for use in template match specs.
   * @public
   * @static
   * @param {*} arguments - If the first parameter is a string then the second
   * parameter must be a {@link ReMix~RegosterMatchSpec} object otherwise
   * a single argument is expected and should be a {@link ReMix~RegiesterMatchObject}.
   * @returns {ReMix}
   */
  ReMix.register = function (identifier, spec) {
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

    ReMix.registered[identifier] = _.isString(spec) ? ReMix._resolveTemplate(spec) : spec;

    return ReMix;
  };
  /**
   * Get the regular expression registered by `identifier`.
   * @see {@link ReMix~register}
   * @param {string} identifier - Name of registered template variable to return.
   * @returns {RegExp} - Registered regular expression.
   */
  ReMix.getRegistered = function (identifier) {
    return ReMix.registered[identifier];
  };
  /**
   * Check is two regular expression can be joined based on {@link ReMix~Options.defaultFlags}.
   * @private
   * @param {RegExp} re1
   * @param {RegExp} re2
   */
  ReMix.prototype._canJoin = function (re1, re2) {
    return (
      (this._flags.i || re1.ignoreCase === re2.ignoreCase) &&
      (this._flags.m ||  re1.multiline === re2.multiline)  &&
      (this._flags.g ||     re1.global === re2.global));
  };
  /**
   * Joins a list of regular expressions together and applies {@link ReMix~Opions.defaultFlags} the
   * final RegExp object.
   * @private
   * @param {RegExp[]} regexn - list of regular expressions to join.
   * @returns {RegExp} regex - a single RegExp object.
   */
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
  /**
   * @typedef {Object} ReMix~Options
   * @property {string} nsDelimiter - Sets the delimiter used for setting the @{link ReMix~Namespace} of named children. Defaults to '.'.
   * @property {(string|string[])} defaultFlags - Default flags for RegExp objects created. Defaults to 'g'.
  /**
   * Set and retrieve current options.
   * @public
   * @param {ReMix~Options} [opt] - Merges with current options if specified.
   * @returns {ReMix~Options} - The current options object.
   */
  ReMix.prototype.options = function (opt) {
    if (opt) _.merge(this._opt, opt);
    var flags = this._flags = {};
    _.forEach(this._opt.defaultFlags, function (c) {
      flags[c] = true;
    });
    return this.opt;
  };
  /**
   * Resolves the given spec in the given namespace.
   * Used for resolving {@link ReMix~NamedRegExp} and {@link ReMix~Pairs}
   * in {@link ReMix#_resolveSpec}.
   * @private
   * @param {ReMix~Namespace} namespace - The namespace to prepend to the current level.
   * @param {ReMix~Spec} spec - The specification to resolve under the give namespace.
   */
  ReMix.prototype._resolveNamed = function (namespace, spec) {
    this._namestack.push(namespace);
    spec = this._resolveSpec(spec);
    this._namestack.pop();
    return spec;
  };
  /**
   * Setup callback. Called during ReMix compilation. Any rules
   * created within this callback are parented by the current Rule.
   * @see {@link ReMix#_resolveNamed}
   * @callback ReMix~SetupCallback
   * @param {string} [namespace] The current namespace.
   * @returns {ReMix~Spec}
   */
  /**
   * The namespace being set. This can be anything but should not
   * contain the {@link ReMix~Options.nsDelimiter}
   * @typedef {string} ReMix~Namespace
   */
  /**
   * This is a simple way to specify a single namespace within the current
   * without having to create a new ReMix object.
   * @typedef {Object} ReMix~NamedRegExp
   * @property {ReMix~Namespace} name - Adds to the current namespace for `re` which affect all children namespaces for matches composed into the ReMix.
   * @property {ReMix~Spec} spec - Specification to fall under `name` namespace.
   */
  /**
   * This template is processed by {@link ReMix#_resolveTemplate}. Templates
   * can contain variable which are delimited by \{\} and have an optional `?+*`
   * modifier.
   * @example
   *  "{word+}{hspace*}{eol?}$"
   * @typedef {string} ReMix~Template
   */
  /**
   * @typedef {ReMix~Argument[]} ReMix~Arguments
   */
  /**

   * This is a simple way to create multiple sub named regular expressions
   * without having to create a new ReMix object for each one.
   * @typedef {Object.<ReMix~Namespace, ReMix~Spec>} ReMix~Pairs
   */
  /**
   * @typedef {(RegExp|ReMix~SetupCallback|ReMix~NamedRegExp|ReMix~Template|ReMix~Arguments|ReMix~Pairs)} ReMix~Argument
   */
  /**
   * @typedef {(ReMix~Arguments|ReMix~Argument)} ReMix~Spec
   */
  /**
   * This is the main entry point when resolving all specifications, which
   * is done at {@link ReMix#compile} time. Specifications are resolved
   * down to their RegExp object. We attach the namespace to the RegExp
   * object using this object's id (a GUID).
   * @private
   * @param {ReMix~Spec} spec - Specification to resolve.
   */
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
    else if (_.has(spec, 'name') && _.has(spec, 'spec'))
      return this._resolveNamed(_.result(spec, 'name'), _.result(spec, 'spec'));
    else if (_.isArray(spec))
      return spec.map(this._resolveSpec.bind(this));
    else if (_.isFunction(spec))
      return this._resolveSpec(spec.call(this, namespace));
    else
      return _.map(spec, function (value, key) {
        return this._resolveNamed(key, _.result(spec, key));
      }.bind(this));
  };
  /**
   * Sets the namespace for the current ReMix instance. If this
   * instance has already been compiled, the compilation is reset
   * and will happen the next time it's needed.
   * @public
   * @param {ReMix~Namespace} [namespace] - If specified, sets the current namespace.
   * @returns {ReMix~Namespace} The current namespace.
   */
  ReMix.prototype.namespace = function (namespace) {
    if (namespace) {
      this._namespace = namespace;
      this._namestack = [namespace];
      if (this._regexn)
        this._regexn = null;
    }
    return this._namespace;
  };
  /**
   * Clears all set specifications and compilations.
   * @returns {ReMix}
   */
  ReMix.prototype.clear = function () {
    this._specs = [];
    if (this._regexn)
      this._regexn = null;
    return this;
  };
  /**
   * Add a specification to the current instance.
   * @param {...ReMix~Spec} spec - All arguments are flattened into a single specification.
   * @returns {this}
   */
  ReMix.prototype.add = function () {
    this._specs = this._specs.concat(_.flatten(arguments));
    if (this._regexn)
      this._regexn = null;
    return this;
  };
  /**
   * Add a named specification. This is synonimous with `remix.add({name: name, spec: spec})`.
   * @public
   * @param {string} name - The namespace for this specification.
   * @param {...ReMix~Spec} spec - The remaining arguments are consumed as the spec.
   * @returns {this}
   */
  ReMix.prototype.addNamed = function (name) {
    var args = _.flatten(arguments).slice(1);
    return this.add({spec: args, name: name});
  };
  /**
   * Returns if this instance has an specifications set.
   * @returns {boolean}
   */
  ReMix.prototype.hasSpecs = function () {
    return this._specs.length > 0;
  };
  /**
   * Compile this ReMix object. Should never need to call. Any method which needs
   * to be compiled will call this.
   * @param {boolean} force - force recompilation.
   * @returns {Array} Regexn
   */
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
  /**
   * Sets the lastIndex property for all compiled regular expressions. Compiles if needed.
   * @param {number} index - The index in your string to set lastIndex to.
   * @returns {this}
   */
  ReMix.prototype.setLastIndex = function (index) {
    this.compile();
    this._regexn.forEach(function (regex) {
      regex.lastIndex = index;
    });
    return this;
  };
  /**
   * The first element is the match array.
   * The second element is the match namespace or empty string if none.
   * The third element is the index into the regexp specifications given.
   * The fourth and last element is the lastIndex of the match.
   * typedef {Array} ReMix~Match
   */
  /**
   * Compiles and executes our list of regular expressions on the given string. This method
   * acts a little like the new `/y` sticky flag. If the match is offset into the string
   * (this regex engine looked past the start of the string) it is considered rejected.
   * The only part of `/y` be haviour missing is the fact that `^` would match beginning
   * of line in `/y` mode even if `/m` is not set. We do not go this far, it would require
   * too much overhead for this library to be useful.
   *
   * All internal RegExp objects are updated with the lastIndex of this match so that calling
   * execute again has the same effect it does on normal regexp object (assuming default 'g'
   * flag is set).
   * @public
   * @param {string} string - The string to execute on
   * @returns {ReMix~Match}
   */
  ReMix.prototype.exec = function (string) {
    this.compile();
    var regexn = this._regexn,
      data = string[this._id] || { s: 0, i: 0 },
      found = false,
      that = this;
    this.setLastIndex(data.i);
    _.forEach(regexn.slice(data.s), function(re, i) {
      var lastIndex = re.lastIndex;
      var match = re.exec(string);
      if (match) { /* Not needed once we have /y flag */
        if ((re.lastIndex - match[0].length) === lastIndex)
          _.forEach(that._resolveMatch(match, i), function (res) {
            if (_.some(res[0], _.isString)) {
              found = res.concat(re.lastIndex);
              return false;
            }
          });
        if (found) {
          data.i = re.lastIndex;
          data.s = i;
          return false;
        }
      }
    });

    if (!found)
      delete string[this._id];
    else
      string[this._id] = data;
    return found;
  };
  /**
   * Resets this instance of ReMix's data about this string.
   * @param {string} str - The source string you passed to {@link ReMix#exec}.
   * @returns {this}
   */
  ReMix.prototype.reset = function (str) {
    delete str[this._id];
    return this;
  };

  /**
   * Resolves matches to their respective namespaces.
   * @private
   * @param {Array} matches - Matches from RegExp.exec() call.
   * @param {Number} index - The index of which joined regular expression matched.
   * @returns {Array} Matches grouped by original specification.
   */
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
  /**
   * For debugging purposes, returns a string representation of our
   * compiled regular expressions.
   * @returns {String}
   */
  ReMix.prototype.toString = function () {
    return this.compile().map(function (re) {
      return re.source;
    }).join('|');
  };
  module.exports = ReMix;
})();