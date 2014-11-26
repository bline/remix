/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  var ReMix = require("./lib/remix");
  module.exports.ReMix = ReMix;
  module.exports.remix = (function () {
    function Re(args) {
      return ReMix.apply(this, args);
    }
    Re.prototype = ReMix.prototype;
    return function () {
      return new Re(arguments);
    };
  })();
})();