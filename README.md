remix
=====

regular expression alternation for tokenizers

## Mixing

```javascript

/* unnammed prositional only matches */
var re = new Re([/foo/, /bar/]);

/* does not combine */
var re = new Re([/foo/, /bar/i]);

```

## Named matches

* example 1

```javascript

var Re = require('remix').ReMix;

/* named match */
var re = new Re('foo', /foo/, /bar/);

var str = 'foobar';
/* [['foo'], 'foo', 0, 3] */
console.log(re.exec(str));
/* [['bar'], 'foo', 1, 6] */
console.log(re.exec(str));

```

* example 2

```javascript

/* embedded matches are namespaced with parent name */
var re = new Re('foo', {foo: /foo/, bar: /bar/});

var str = 'foobar';
/* [['foo'], 'foo.foo', 0, 3] */
console.log(re.exec(str));
/* [['bar'], 'foo.bar', 1, 6] */
console.log(re.exec(str));


/* alternative syntax */
var re = new Re('foo', [/foo/, /bar/]);

/* embedded named matches */
var re = new Re({foo: /foo/, bar: /bar/});

```

* template examples

```javascript

Re.register('matchFoo', /foo/);
var re = new Re('foo', 'matchFoo');

var re = new Re('bar', '`matchFoo*`|bar');

Re.register('matchFooOrBar', '`matchFoo`|bar');
var re = new Re('bax', '\\s*`matchFooOrBar+`\\s*');

```

