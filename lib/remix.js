
/**
 * @copyright
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
   * The name sets this ReMix's name. The name is used when
   * returning matches. All sub-child matches are namespaced based
   * on the hierarchy of names. `name` is optional.
   *
   * Any arguments after `name` are passed to {@link ReMix#add}.
   * @constructor
   * @alias ReMix
   * @public
   * @param {ReMix~Name} [name] - The name for this ReMix object.
   * @param {ReMix~Spec} spec - Specification for this ReMix object.
   * @example
   *  var a1 = new ReMix('a1'),
   *      a2 = new ReMix('a2'),
   *     str = "foobar";
   *
   *  a1.options({nsDelimiter: '/'});
   *  a1.add({foo: /foo/});
   *  a2.add({bar: /bar/});
   *
   *  a1.add(a2);
   *
   *  console.log(a1.exec(str)); // [['foo'], 'a1/foo',    0, 3]
   *  console.log(a1.exec(str)); // [['foo'], 'a1/a2/bar', 1, 6]
   */
  function ReMix(name) {
    var args = _.flatten(_.toArray(arguments));
    if (_.isString(name) || _.isNull(name) || _.isUndefined(name))
      args = args.slice(1);
    else
      name = undefined;
    /**
     * Unique id used for storing data in RegExp objects
     * @private
     */
    this._id           = genguid();
    /**
     * Current instance options
     * @private
     */
    this._opt          = {};
    /**
     * Stores current unresolved specification
     * @private
     */
    this._specs        = [];
    /**
     * Tracking data for relating namespace to match index
     * @private
     */
    this._matches      = [];
    /**
     * This ReMix's name
     * @private
     */
    this._name         = name;
    /**
     * Used when composing ReMix objects or named RegExp objects. {@link module:lib/remix#scope}
     * @private
     */
    this._namestack    = [];
    /**
     * Used to track position when executing regular expression
     * @private
     */
    this._lastIndex     = 0;
    if (name)
      this._namestack.push(name);
    this.options(ReMix.defaultOptions);
    if (args.length)
      this.add(args);
  }
  /** Default registered templates
   * @category Template
   * @memberOf ReMix
   * @name registered
   * @private
   */
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
    /** WORD */
    word:            /\w/,
    /** NOWORD */
    noWord:          /\W/,
    /** Match any one character, doesn't depend on RegExp flags */
    any:             /[\S\s]/,
    /** Match EOL on any platform */
    eol:             /(?:\r\n?|\n|\f)/,
    /** Not EOL character class */
    notEol:          /[^\r\n\f]/,
    /** END of string or line depending on RegExp flags */
    end:             /$/,
    /** Beginning of line or string depending on RegExp flags */
    begin:           /^/,
    /* TODO REMOVE */
    cMultiComment:   /\/\*[^*]*\*+(?:[^\/*][^*]*\*+)*\//
  };
  /**
   * Internally used regular expressions
   * @category Options
   * @private
   */
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
   * @static
   * @type {ReMix~Options}
   * @category Options
   */
  ReMix.defaultOptions = {
    nsDelimiter: '.',
    defaultFlags: 'g'
  };
  /**
   * Counts left parens for figuring out match indexes when joining regular
   * expressions.
   * @private
   * @static
   * @param {string} regexp - source of regular expression to count parans on
   * @returns {number} parens - number of left non-escaped parentheses
   * @category Resolve
   */
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
   * @static
   * @param {string} match - Full template match (unused).
   * @param {string} key - The key/modifier match to resolve.
   * @returns {string} regexp - generated regexp from variable or the variable it's self if no registered matches were found.
   * @category Template
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
   * @static
   * @param {ReMix~Template}
   * @returns {RegExp}
   * @categoy Template
   */
  ReMix._resolveTemplate = function (str) {
      str = ReMix._resolveVariable(str, str);
      str = str.replace(ReMix.RE.templates, ReMix._resolveVariable);
      return new RegExp(str);
  };
  /**
   * Register a new match template variable for use in template match specs.
   *
   * @public
   * @static
   * @param {*} arguments - Arguments are in one of two
   * formats. Both forms specify `name`/`spec` pair(s). A name is a simple identifier
   * which should match `/^\w+$/`. The `spec` can be either a regular expression or
   * or another template.
   * @returns {ReMix}
   * @category Template
   * @example
   *  ReMix.register('end', /$/)
   *       .register('eol', /(?:\r\n?|\n|\f)/);
   *
   *  ReMix.register({
   *    word:        /\w+/,
   *    space:       /\s+/,
   *    wordOrSpace: '{word}|{space}'
   *  });
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
   * @see {@link ReMix.register}
   * @param {string} identifier - Name of registered template variable to return.
   * @returns {RegExp} - Registered regular expression.
   * @category Template
   * @example
   *  var regex = ReMix.getRegistered('templateName');
   */
  ReMix.getRegistered = function (identifier) {
    return ReMix.registered[identifier];
  };
  /**
   * Check is two regular expression can be joined based on {@link ReMix~Options.defaultFlags}.
   * @private
   * @param {RegExp} re1
   * @param {RegExp} re2
   * @returns {boolean}
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
   *
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
   * Set and retrieve current options.
   *
   * @public
   * @param {ReMix~Options} [opt] - Merges with current options if specified.
   * @returns {ReMix~Options} - The current options object.
   * @category Options
   * @example
   *  var remix = new ReMix();
   *  remix.options({
   *    nsDelimiter:  '.', // default
   *    defaultFlags: 'g'  // default
   *  });
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
   * Resolves the given spec in the given name parent.
   * Used for resolving {@link ReMix~NamedRegExp} and {@link ReMix~Pairs}
   * in {@link ReMix#_resolveSpec}.
   *
   * @private
   * @param {ReMix~Name} name - The name to append to the current namespace level.
   * @param {ReMix~Spec} spec - The specification to resolve under the give namespace.
   * @category Resolve
   */
  ReMix.prototype._resolveNamed = function (name, spec) {
    this._namestack.push(name);
    spec = this._resolveSpec(spec);
    this._namestack.pop();
    return spec;
  };
  /**
   * This is the main entry point when resolving all specifications, which
   * is done at {@link ReMix#compile} time. Specifications are resolved
   * down to their RegExp object. We attach the namespace to the RegExp
   * object using this object's id (a GUID).
   * @private
   * @param {ReMix~Spec} spec - Specification to resolve.
   * @returns this
   * @category Resolve
   */
  ReMix.prototype._resolveSpec = function (spec) {
    var namespace = this._namestack.join(this._opt.nsDelimiter);
    if (_.isRegExp(spec)) {
      spec[this._id] = namespace;
      return spec;
    } else if (spec instanceof ReMix) {
      if (spec._name) {
        return this._resolveNamed(spec._name, spec._specs);
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
    return this;
  };
  /**
   * Sets the name for the current ReMix instance. If this
   * instance has already been compiled, the compilation is reset
   * and will happen the next time it's needed.
   * @public
   * @param {ReMix~Name} [name] - If specified, sets the current name.
   * @returns {ReMix~Name} The current name.
   * @category Resolve
   * @example
   *  var remix = new ReMix();
   *  remix.name('s1');
   *  remix.add(/foo/);
   *
   *  remix.exec("foo"); // [['foo'], 's1', 0, 3]
   */
  ReMix.prototype.name = function (name) {
    if (name) {
      this._name = name;
      this._namestack = [name];
      if (this._regexn)
        this._regexn = null;
    }
    return this._name;
  };
  /**
   * Clears all set specifications and compilations.
   * @returns this
   * @category Match
   */
  ReMix.prototype.clear = function () {
    this._specs = [];
    if (this._regexn)
      this._regexn = null;
    this.setLastIndex(0);
    return this;
  };
  /**
   * Add a specification to the current instance.
   * @param {...ReMix~Spec} spec - All arguments are flattened into a single specification.
   * @returns this
   * @categroy Match
   */
  ReMix.prototype.add = function () {
    this._specs = this._specs.concat(_.flatten(arguments));
    if (this._regexn)
      this._regexn = null;
    return this;
  };
  /**
   * Add a named specification. This is synonymous with `remix.add({name: name, spec: spec})`.
   * @public
   * @param {string} name - The name for this specification.
   * @param {...ReMix~Spec} spec - The remaining arguments are consumed as the spec.
   * @returns this
   * @categroy Match
   */
  ReMix.prototype.addNamed = function (name) {
    var args = _.flatten(arguments).slice(1);
    return this.add({spec: args, name: name});
  };
  /**
   * Returns if this instance has an specifications set.
   * @returns {boolean}
   * @category Resolve
   */
  ReMix.prototype.hasSpecs = function () {
    return this._specs.length > 0;
  };
  /**
   * Compile this ReMix object. Should never need to call. Any method which needs
   * to be compiled will call this.
   * @param {boolean} force - force recompilation.
   * @returns {Array} Regexn
   * @category Match
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
   * Sets the `lastIndex` to start at for the next `exec()` call.
   * @param {number} index - The index in your string to set lastIndex to.
   * @returns this
   * @category Match
   */
  ReMix.prototype.setLastIndex = function (index) {
    this._lastIndex = index;
    return this;
  };
  /**
   * Compiles and executes our list of regular expressions on the given string. This method
   * acts a little like the new `/y` sticky flag. If the match is offset into the string
   * (the regex engine looked past the start of the string) it is considered rejected.
   *
   * The only part of `/y` be haviour missing is the fact that `^` would match beginning
   * of line in `/y` mode even if `/m` is not set. We do not go this far, it would require
   * too much overhead for this library to be useful.
   *
   * All internal RegExp objects are updated with the lastIndex of this match so that calling
   * `exec()` again has the same effect it does on normal `RegExp` objects (assuming default 'g'
   * flag is set).
   *
   * @public
   * @param {string} string - The string to execute on
   * @returns {ReMix~Match}
   * @category Match
   * @example
   *  var re = new ReMix('fb', { foo: /(fo)o/, bar: /ba(r)/ });
   *  var str = "foobar", match;
   *                        // match           Namespace  Spec Idx  lastIndex
   *  match = re.exec(str); // [['foo', 'fo'], 'fb.foo',  0,        3]
   *  match = re.exec(str); // [['bar',  'r'], 'fb.bar',  1,        6]
   *  match = re.exec(str); // false
   */
  ReMix.prototype.exec = function (string) {
    this.compile();
    var lastIndex = this._lastIndex,
      found = false,
      that = this;
    _.forEach(this._regexn, function(re, i) {
      re.lastIndex = lastIndex;
      var match = re.exec(string);
      if (match) {
        /* Not needed once we have /y flag */
        if ((re.lastIndex - match[0].length) === lastIndex) {
          _.forEach(that._resolveMatch(match, i), function (res) {
            if (_.some(res[0], _.isString)) {
              found = res.concat(re.lastIndex);
              return false;
            }
          });
        }
        if (found) {
          that._lastIndex = re.lastIndex;
          return false;
        }
      }
    });

    if (!found)
      this._lastIndex = 0;
    return found;
  };
  /**
   * Resolves matches to their respective namespaces.
   * @private
   * @param {Array} matches - Matches from RegExp.exec() call.
   * @param {Number} index - The index of which joined regular expression matched.
   * @returns {Array} Matches grouped by original specification.
   * @category Match
   */
  ReMix.prototype._resolveMatch = function (matches, index) {
    matches.shift(); // full match
    var lastSet = _.last(this._matches[index]);
    if (matches.length < lastSet[1] + 1)
      matches.length = lastSet[1] + 1;
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
  ReMix.prototype.asString = function () {
    return this.compile().map(function (re) {
      return re.source;
    }).join('|');
  };
  module.exports = ReMix;
  /**
   * @typedef {(RegExp|ReMix~Template)} ReMix~RegisterMatchSpec
   * @category Template
   * @example
   *  ReMix.register('eol',        /(?:\r\n?|\n|\f)/);
   *  ReMix.register('emptyLines', '{eol}{eol+}');
   */
  /**
   * @typedef {Object.<string, ReMix~RegisterMatchSpec>} ReMix~RegisterMatchObject
   * @category Template
   * @example
   *  ReMix.register({
   *    cMultiComment: /\/\*[^*]*\*+(?:[^\/*][^*]*\*+)*\//,
   *    cLineComment:  "//{notEol*}{eol}"
   *  });
   */
  /**
   * @typedef {Object} ReMix~Options
   * @property {string} nsDelimiter - Sets the delimiter used for setting the {@link ReMix~Namespace} of named children. Defaults to '.'.
   * @property {(string|string[])} defaultFlags - Default flags for RegExp objects created. Defaults to 'g'.
   * @category Options
   */
  /**
   * Setup callback. Called during ReMix compilation. Any rules
   * created within this callback are parented by the current Rule.
   *
   * @callback ReMix~SetupCallback
   * @param {string} [namespace] The current namespace.
   * @returns {ReMix~Spec}
   * @example
   *  var re = new ReMix(function () {
   *    return {
   *      foo: /foo/,
   *      bar: /bar/
   *    };
   *  });
   */
  /**
   * The name being set. This can be anything but should not
   * contain the {@link ReMix~Options.nsDelimiter}
   *
   * @typedef {string} ReMix~Name
   * @example
   *  var re = new ReMix();
   *  re.name("foo");
   *  re.add({bar: /bar/});
   *  re.add({baz: /baz/});
   *  var str = "barbaz", match;
   *
   *  match = re.exec(str); // [["bar"], "foo.bar", 0, 3]
   *  match = re.exec(str); // [["baz"], "foo.baz", 1, 6]
   */
  /**
   * This is a simple way to specify a single named specification within the current
   * without having to create a new `ReMix` object.
   *
   * @typedef {Object} ReMix~NamedRegExp
   * @property {ReMix~Name} name - Adds to the current name for `re` which affect all children names for matches composed into the `ReMix`.
   * @property {ReMix~Spec} spec - Specification to fall under `name` namespace.
   * @example
   *  var re = new ReMix({name: "myname", spec: /regex/});
   */
  /**
   * This template is processed by {@link ReMix#_resolveTemplate}. Templates
   * can contain variable which are delimited by \{\} and have an optional `?+*`
   * modifier.
   *
   * @typedef {string} ReMix~Template
   * @example
   *  var re = new ReMix();
   *  re.add("{word+}{hspace*}{eol?}$");
   *
   *  ReMix.register('foo', /foo/);
   *  ReMix.register('fooOrBar', '{bar}|bar');
   *
   *  re.add("{fooOrBar?}{foo}\\s+");       // don't forget to escape backslash
   *
   *  re.add(/{fooOrBar?}{foo}\s+/.source); // alternativly, {} has no special meaning in
   *                                        // Regular expressions
   *
   */
  /**
   * This is a simple way to create multiple sub named regular expressions
   * without having to create a new ReMix object for each one.
   *
   * @typedef {Object.<ReMix~Namespace, ReMix~Spec>} ReMix~Pairs
   * @category Resolve
   * @example
   *  var re = new ReMix({
   *    name1: /foo/, // name1     -> /foo/
   *    name2: {
   *      bar: /bar/  // name2.bar -> /bar/
   *      baz: /baz/  // name2.baz -> /baz/
   *    }
   *  });
   */
  /**
   * @typedef {(RegExp|ReMix|ReMix~SetupCallback|ReMix~NamedRegExp|ReMix~Template|ReMix~Spec[]|ReMix~Pairs)} ReMix~Spec
   * @category Resolve
   * @example
   *  var re = new ReMix();
   *  re.add(/regexp/);        // RegExp
   *  re.add(function () {     // {@link ReMix~SetupCallback}
   *    return {               // {@link ReMix~NamedRegExp}
   *      name: "foo"
   *      spec: [              // {@link ReMix~Spec}[]
   *        {                  // {@link ReMix~Pairs}
   *          baz: 'foo{eol}$' // {@link ReMix~Template}
   *        },
   *        function () {      // {@link ReMix~SetupCallback}
   *          return /bar/
   *        }
   *      ]
   *    };
   *  });
   */
  /**
   * The first element is the match array.
   * The second element is the match namespace or empty string if none.
   * The third element is the index into the regexp specifications given.
   * The fourth and last element is the lastIndex of the match.
   *
   * typedef {(Array|false)} ReMix~Match
   * @category Match
   * @example
   *  var re = new ReMix('foobar', /foo(bar)/, { bar: /bar/, baz: { boo: /boo/ } });
   *  var str = "foobarboobarfoobar", match;
   *
   *  match = re.exec(str); // [ [ 'foobar', 'bar' ], 'foobar',         0,  6 ]
   *  match = re.exec(str); // [ [ 'boo'           ], 'foobar.baz.boo', 2,  9 ]
   *  match = re.exec(str); // [ [ 'bar'           ], 'foobar.bar',     1, 12 ]
   *  match = re.exec(str); // [ [ 'foobar', 'bar' ], 'foobar',         0, 18 ]
   *  match = re.exec(str); // false
   */
})();