remix
=====
[![NPM](https://nodei.co/npm/remix.png?compact=true)](https://npmjs.org/package/remix)

[![Coverage Status](https://img.shields.io/coveralls/bline/remix.svg)](https://coveralls.io/r/bline/remix?branch=master) [![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/bline/remix?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

regular expression alternation for tokenizers

# What is this?

This allows joining regular expressions mainly for the purpose of constructing
tokenizers.

# Matching

This library emulates to some degree the new sticky `/y` flag. The sticky flag
has 3 basic effects on a regular expression.

1. Implicit `/g`
2. Not looking past `lastIndex`
3. Treating the string as if it starts at `lastIndex`.

The first one if obvious, we simply default to `/g`. The second one
is a little more complex, but we manage. If a match looks forward, the
`exec()` method will reject the match.

Only the last one do we not support. It would require making a partial copy
of the string per match which would have a significant overhead with little
or no gain. Only when then `/y` flag is widely adopted will this be possible.

## Add Specification


```javascript
var re = new ReMix();
re.add(/regexp/);       // RegExp
re.add(function () {    // {@link ReMix~SetupCallback}
 return {               // {@link ReMix~NamedRegExp}
   name: "foo"
   spec: [              // {@link ReMix~Spec}[]
     {                  // {@link ReMix~Pairs}
       baz: 'foo{eol}$' // {@link ReMix~Template}
     },
     function () {      // {@link ReMix~SetupCallback}
       return /bar/
     }
   ]
 };
});
```

## Combining

Regular expressions are combined if their flags, which are not in
[defaultFlags](#options) are the same. In other words, defaultFlags
are ignored for the purpose of comparing.

```javascript

/* combines */
var re = new Re([/foo/, /bar/g]); // /g is defualt flag
console.log(re.compile()); // [/(foo)|(bar)/]

/* does not combine */
var re = new Re([/foo/, /bar/i]);
console.log(re.compile()); // [/(foo)/, /(bar)/i]

```

## Naming

Each regular expression can be named and have sub-named expressions
which are tracked by namespaces with configurable [delimiters](#options). `ReMix`
object can also compose other `ReMix` objects which are also namespaced into the
current level.

Namespaces are returned as the second element in the match array returned by
`exec()`.

```javascript
var re = new ReMix('foobar', /foo(bar)/, { bar: /bar/, baz: { boo: /boo/ } });
var str = "foobarboobarfoobar", match;

match = re.exec(str); // [ [ 'foobar', 'bar' ], 'foobar',         0,  6 ]
match = re.exec(str); // [ [ 'boo'           ], 'foobar.baz.boo', 2,  9 ]
match = re.exec(str); // [ [ 'bar'           ], 'foobar.bar',     1, 12 ]
match = re.exec(str); // [ [ 'foobar', 'bar' ], 'foobar',         0, 18 ]
match = re.exec(str); // false
```

```javascript
var a1 = new ReMix('a1'),
    a2 = new ReMix('a2'),
   str = "foobar";

a1.options({nsDelimiter: '/'});
a1.add({foo: /foo/});
a2.add({bar: /bar/});

a1.add(a2);

console.log(a1.exec(str)); // [['foo'], 'a1/foo',    0, 3]
console.log(a1.exec(str)); // [['foo'], 'a1/a2/bar', 1, 6]
```

## Templates

Templates are a very simple way to compose regular expressesion. Templates
can be used in the place of regular expressions. You can register new templates
or use the existing predefined templates. Here is a list:


* hspace - Horizontal space, including unicode horizontal space code points

* noHspace - hspace negated

* vspace - Vertical space character class

* number - General number match, includes all Javascript supported number formated

* noVspace - Negated vspace character class

* space - /\s/

* noSpace - /\S/

* word - /\w/

* noWord - /\W/

* any - Match any one character, doesn't depend on RegExp flags

* eol - Match EOL on any platform

* notEol- Not EOL character class

* end - END of string or line depending on RegExp flags

* begin - Beginning of line or string depending on RegExp flags

Registering a template has two formats:

```javascript
ReMix.register('eol',        /(?:\r\n?|\n|\f)/);
ReMix.register('emptyLines', '{eol}{eol+}');

ReMix.register({
  cMultiComment: /\/\*[^*]*\*+(?:[^\/*][^*]*\*+)*\//,
  cLineComment:  "//{notEol*}{eol}"
});
```

Example of how templates integrate with ReMix.
```javascript
ReMix.register('matchFoo', /foo/);
var remix = new ReMix('foo', 'matchFoo');

var remix = new ReMix('bar', '{matchFoo*}|bar');

ReMix.register('matchFooOrBar', '{matchFoo}|bar');
var remix = new ReMix('bax', '\\s*{matchFooOrBar+}\\s*');

```

# BUGS

Please report bug [here](https://github.com/bline/remix/issues).

***This is BETA software. Please report bugs or submit PR's.***

Although I know of no bugs, the current test coverage is not complete.

# TODO

* Complete test coverage.
* Add browser tests.
* Add travis.
* Add badges.
* Better, less contrived examples.
* More information in this README.md.

# SEE ALSO

[ReMix Class API Documentation](http://bline.github.io/remix/ReMix.html)

# LICENSE

Copyright (C) 2014 Scott Beck, all rights reserved

Licensed under the [MIT](./LICENSE) license
