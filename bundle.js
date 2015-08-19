(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process){
'use strict';

module.exports = function (cb, opts) {
    var page = new Page(cb, opts);
    window.addEventListener('popstate', onpopstate);

    function onpopstate() {
        var href = window.location.pathname + (window.location.hash || '');
        page.show(href);
    }
    process.nextTick(onpopstate);

    var fn = function fn(href) {
        return page.show(href);
    };
    fn.push = function (href) {
        return page.push(href);
    };
    fn.show = function (href) {
        return page.show(href);
    };
    return fn;
};

function Page(cb, opts) {
    if (!opts) opts = {};
    this.current = null;
    this.hasPushState = opts.pushState !== undefined ? opts.pushState : window.history && window.history.pushState;
    this.scroll = opts.saveScroll !== false ? {} : null;
    this.cb = cb;
}

Page.prototype.show = function (href) {
    href = href.replace(/^\/+/, '/');

    if (this.current === href) return;
    this.saveScroll(href);
    this.current = href;

    var scroll = this.scroll[href];
    this.cb(href, {
        scrollX: scroll && scroll[0] || 0,
        scrollY: scroll && scroll[1] || 0
    });

    this.pushHref(href);
};

Page.prototype.saveScroll = function (href) {
    if (this.scroll && this.current) {
        this.scroll[this.current] = [window.scrollX, window.scrollY];
    }
};

Page.prototype.push = function (href) {
    href = href.replace(/^\/+/, '/');
    this.saveScroll(href);
    this.pushHref(href);
};

Page.prototype.pushHref = function (href) {
    this.current = href;
    var mismatched = window.location.pathname + (window.location.hash || '') !== href;
    if (mismatched) window.history.pushState(null, '', href);
};

}).call(this,require('_process'))
},{"_process":3}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.3.2 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * http://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.3.2',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],5:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],6:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],7:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":5,"./encode":6}],8:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var punycode = require('punycode');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a puny coded representation of "domain".
      // It only converts the part of the domain name that
      // has non ASCII characters. I.e. it dosent matter if
      // you call it with a domain that already is in ASCII.
      var domainArray = this.hostname.split('.');
      var newOut = [];
      for (var i = 0; i < domainArray.length; ++i) {
        var s = domainArray[i];
        newOut.push(s.match(/[^A-Za-z0-9_-]/) ?
            'xn--' + punycode.encode(s) : s);
      }
      this.hostname = newOut.join('.');
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  Object.keys(this).forEach(function(k) {
    result[k] = this[k];
  }, this);

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    Object.keys(relative).forEach(function(k) {
      if (k !== 'protocol')
        result[k] = relative[k];
    });

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      Object.keys(relative).forEach(function(k) {
        result[k] = relative[k];
      });
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especialy happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!isNull(result.pathname) || !isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host) && (last === '.' || last === '..') ||
      last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last == '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especialy happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!isNull(result.pathname) || !isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

function isString(arg) {
  return typeof arg === "string";
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isNull(arg) {
  return arg === null;
}
function isNullOrUndefined(arg) {
  return  arg == null;
}

},{"punycode":4,"querystring":7}],9:[function(require,module,exports){
var url = require('url');

module.exports = function (root, cb) {
    root.addEventListener('click', function (ev) {
        if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.defaultPrevented) {
            return true;
        }
        
        var anchor = null;
        for (var n = ev.target; n.parentNode; n = n.parentNode) {
            if (n.nodeName === 'A') {
                anchor = n;
                break;
            }
        }
        if (!anchor) return true;
        
        var href = anchor.getAttribute('href');
        var u = url.parse(anchor.getAttribute('href'));
        
        if (u.host && u.host !== location.host) return true;
        
        ev.preventDefault();
        
        var base = location.protocol + '//' + location.host;
        
        cb(url.resolve(location.pathname, u.path) + (u.hash || ''));
        return false;
    });
};

},{"url":8}],10:[function(require,module,exports){
module.exports = function (css, customDocument) {
  var doc = customDocument || document;
  if (doc.createStyleSheet) {
    var sheet = doc.createStyleSheet()
    sheet.cssText = css;
    return sheet.ownerNode;
  } else {
    var head = doc.getElementsByTagName('head')[0],
        style = doc.createElement('style');

    style.type = 'text/css';

    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(doc.createTextNode(css));
    }

    head.appendChild(style);
    return style;
  }
};

module.exports.byUrl = function(url) {
  if (document.createStyleSheet) {
    return document.createStyleSheet(url).ownerNode;
  } else {
    var head = document.getElementsByTagName('head')[0],
        link = document.createElement('link');

    link.rel = 'stylesheet';
    link.href = url;

    head.appendChild(link);
    return link;
  }
};

},{}],11:[function(require,module,exports){
var raf = require("raf")
var TypedError = require("error/typed")

var InvalidUpdateInRender = TypedError({
    type: "main-loop.invalid.update.in-render",
    message: "main-loop: Unexpected update occurred in loop.\n" +
        "We are currently rendering a view, " +
            "you can't change state right now.\n" +
        "The diff is: {stringDiff}.\n" +
        "SUGGESTED FIX: find the state mutation in your view " +
            "or rendering function and remove it.\n" +
        "The view should not have any side effects.\n",
    diff: null,
    stringDiff: null
})

module.exports = main

function main(initialState, view, opts) {
    opts = opts || {}

    var currentState = initialState
    var create = opts.create
    var diff = opts.diff
    var patch = opts.patch
    var redrawScheduled = false

    var tree = opts.initialTree || view(currentState)
    var target = opts.target || create(tree, opts)
    var inRenderingTransaction = false

    currentState = null

    return {
        target: target,
        update: update
    }

    function update(state) {
        if (inRenderingTransaction) {
            throw InvalidUpdateInRender({
                diff: state._diff,
                stringDiff: JSON.stringify(state._diff)
            })
        }

        if (currentState === null && !redrawScheduled) {
            redrawScheduled = true
            raf(redraw)
        }

        currentState = state
    }

    function redraw() {
        redrawScheduled = false;
        if (currentState === null) {
            return
        }

        inRenderingTransaction = true
        var newTree = view(currentState)

        if (opts.createOnly) {
            inRenderingTransaction = false
            create(newTree, opts)
        } else {
            var patches = diff(tree, newTree, opts)
            inRenderingTransaction = false
            target = patch(target, patches, opts)
        }

        tree = newTree
        currentState = null
    }
}

},{"error/typed":15,"raf":16}],12:[function(require,module,exports){
module.exports = function(obj) {
    if (typeof obj === 'string') return camelCase(obj);
    return walk(obj);
};

function walk (obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (isDate(obj) || isRegex(obj)) return obj;
    if (isArray(obj)) return map(obj, walk);
    return reduce(objectKeys(obj), function (acc, key) {
        var camel = camelCase(key);
        acc[camel] = walk(obj[key]);
        return acc;
    }, {});
}

function camelCase(str) {
    return str.replace(/[_.-](\w|$)/g, function (_,x) {
        return x.toUpperCase();
    });
}

var isArray = Array.isArray || function (obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
};

var isDate = function (obj) {
    return Object.prototype.toString.call(obj) === '[object Date]';
};

var isRegex = function (obj) {
    return Object.prototype.toString.call(obj) === '[object RegExp]';
};

var has = Object.prototype.hasOwnProperty;
var objectKeys = Object.keys || function (obj) {
    var keys = [];
    for (var key in obj) {
        if (has.call(obj, key)) keys.push(key);
    }
    return keys;
};

function map (xs, f) {
    if (xs.map) return xs.map(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        res.push(f(xs[i], i));
    }
    return res;
}

function reduce (xs, f, acc) {
    if (xs.reduce) return xs.reduce(f, acc);
    for (var i = 0; i < xs.length; i++) {
        acc = f(acc, xs[i], i);
    }
    return acc;
}

},{}],13:[function(require,module,exports){
var nargs = /\{([0-9a-zA-Z]+)\}/g
var slice = Array.prototype.slice

module.exports = template

function template(string) {
    var args

    if (arguments.length === 2 && typeof arguments[1] === "object") {
        args = arguments[1]
    } else {
        args = slice.call(arguments, 1)
    }

    if (!args || !args.hasOwnProperty) {
        args = {}
    }

    return string.replace(nargs, function replaceArg(match, i, index) {
        var result

        if (string[index - 1] === "{" &&
            string[index + match.length] === "}") {
            return i
        } else {
            result = args.hasOwnProperty(i) ? args[i] : null
            if (result === null || result === undefined) {
                return ""
            }

            return result
        }
    })
}

},{}],14:[function(require,module,exports){
module.exports = extend

function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],15:[function(require,module,exports){
var camelize = require("camelize")
var template = require("string-template")
var extend = require("xtend/mutable")

module.exports = TypedError

function TypedError(args) {
    if (!args) {
        throw new Error("args is required");
    }
    if (!args.type) {
        throw new Error("args.type is required");
    }
    if (!args.message) {
        throw new Error("args.message is required");
    }

    var message = args.message

    if (args.type && !args.name) {
        var errorName = camelize(args.type) + "Error"
        args.name = errorName[0].toUpperCase() + errorName.substr(1)
    }

    extend(createError, args);
    createError._name = args.name;

    return createError;

    function createError(opts) {
        var result = new Error()

        Object.defineProperty(result, "type", {
            value: result.type,
            enumerable: true,
            writable: true,
            configurable: true
        })

        var options = extend({}, args, opts)

        extend(result, options)
        result.message = template(message, options)

        return result
    }
}


},{"camelize":12,"string-template":13,"xtend/mutable":14}],16:[function(require,module,exports){
var now = require('performance-now')
  , global = typeof window === 'undefined' ? {} : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = global['request' + suffix]
  , caf = global['cancel' + suffix] || global['cancelRequest' + suffix]
  , isNative = true

for(var i = 0; i < vendors.length && !raf; i++) {
  raf = global[vendors[i] + 'Request' + suffix]
  caf = global[vendors[i] + 'Cancel' + suffix]
      || global[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  isNative = false

  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  if(!isNative) {
    return raf.call(global, fn)
  }
  return raf.call(global, function() {
    try{
      fn.apply(this, arguments)
    } catch(e) {
      setTimeout(function() { throw e }, 0)
    }
  })
}
module.exports.cancel = function() {
  caf.apply(global, arguments)
}

},{"performance-now":17}],17:[function(require,module,exports){
(function (process){
// Generated by CoffeeScript 1.6.3
(function() {
  var getNanoSeconds, hrtime, loadTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - loadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    loadTime = getNanoSeconds();
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);

/*

*/

}).call(this,require('_process'))
},{"_process":3}],18:[function(require,module,exports){
var css = "/*! normalize.css v3.0.3 | MIT License | github.com/necolas/normalize.css */\n\n/**\n * 1. Set default font family to sans-serif.\n * 2. Prevent iOS and IE text size adjust after device orientation change,\n *    without disabling user zoom.\n */\n\nhtml {\n  font-family: sans-serif; /* 1 */\n  -ms-text-size-adjust: 100%; /* 2 */\n  -webkit-text-size-adjust: 100%; /* 2 */\n}\n\n/**\n * Remove default margin.\n */\n\nbody {\n  margin: 0;\n}\n\n/* HTML5 display definitions\n   ========================================================================== */\n\n/**\n * Correct `block` display not defined for any HTML5 element in IE 8/9.\n * Correct `block` display not defined for `details` or `summary` in IE 10/11\n * and Firefox.\n * Correct `block` display not defined for `main` in IE 11.\n */\n\narticle,\naside,\ndetails,\nfigcaption,\nfigure,\nfooter,\nheader,\nhgroup,\nmain,\nmenu,\nnav,\nsection,\nsummary {\n  display: block;\n}\n\n/**\n * 1. Correct `inline-block` display not defined in IE 8/9.\n * 2. Normalize vertical alignment of `progress` in Chrome, Firefox, and Opera.\n */\n\naudio,\ncanvas,\nprogress,\nvideo {\n  display: inline-block; /* 1 */\n  vertical-align: baseline; /* 2 */\n}\n\n/**\n * Prevent modern browsers from displaying `audio` without controls.\n * Remove excess height in iOS 5 devices.\n */\n\naudio:not([controls]) {\n  display: none;\n  height: 0;\n}\n\n/**\n * Address `[hidden]` styling not present in IE 8/9/10.\n * Hide the `template` element in IE 8/9/10/11, Safari, and Firefox < 22.\n */\n\n[hidden],\ntemplate {\n  display: none;\n}\n\n/* Links\n   ========================================================================== */\n\n/**\n * Remove the gray background color from active links in IE 10.\n */\n\na {\n  background-color: transparent;\n}\n\n/**\n * Improve readability of focused elements when they are also in an\n * active/hover state.\n */\n\na:active,\na:hover {\n  outline: 0;\n}\n\n/* Text-level semantics\n   ========================================================================== */\n\n/**\n * Address styling not present in IE 8/9/10/11, Safari, and Chrome.\n */\n\nabbr[title] {\n  border-bottom: 1px dotted;\n}\n\n/**\n * Address style set to `bolder` in Firefox 4+, Safari, and Chrome.\n */\n\nb,\nstrong {\n  font-weight: bold;\n}\n\n/**\n * Address styling not present in Safari and Chrome.\n */\n\ndfn {\n  font-style: italic;\n}\n\n/**\n * Address variable `h1` font-size and margin within `section` and `article`\n * contexts in Firefox 4+, Safari, and Chrome.\n */\n\nh1 {\n  font-size: 2em;\n  margin: 0.67em 0;\n}\n\n/**\n * Address styling not present in IE 8/9.\n */\n\nmark {\n  background: #ff0;\n  color: #000;\n}\n\n/**\n * Address inconsistent and variable font size in all browsers.\n */\n\nsmall {\n  font-size: 80%;\n}\n\n/**\n * Prevent `sub` and `sup` affecting `line-height` in all browsers.\n */\n\nsub,\nsup {\n  font-size: 75%;\n  line-height: 0;\n  position: relative;\n  vertical-align: baseline;\n}\n\nsup {\n  top: -0.5em;\n}\n\nsub {\n  bottom: -0.25em;\n}\n\n/* Embedded content\n   ========================================================================== */\n\n/**\n * Remove border when inside `a` element in IE 8/9/10.\n */\n\nimg {\n  border: 0;\n}\n\n/**\n * Correct overflow not hidden in IE 9/10/11.\n */\n\nsvg:not(:root) {\n  overflow: hidden;\n}\n\n/* Grouping content\n   ========================================================================== */\n\n/**\n * Address margin not present in IE 8/9 and Safari.\n */\n\nfigure {\n  margin: 1em 40px;\n}\n\n/**\n * Address differences between Firefox and other browsers.\n */\n\nhr {\n  box-sizing: content-box;\n  height: 0;\n}\n\n/**\n * Contain overflow in all browsers.\n */\n\npre {\n  overflow: auto;\n}\n\n/**\n * Address odd `em`-unit font size rendering in all browsers.\n */\n\ncode,\nkbd,\npre,\nsamp {\n  font-family: monospace, monospace;\n  font-size: 1em;\n}\n\n/* Forms\n   ========================================================================== */\n\n/**\n * Known limitation: by default, Chrome and Safari on OS X allow very limited\n * styling of `select`, unless a `border` property is set.\n */\n\n/**\n * 1. Correct color not being inherited.\n *    Known issue: affects color of disabled elements.\n * 2. Correct font properties not being inherited.\n * 3. Address margins set differently in Firefox 4+, Safari, and Chrome.\n */\n\nbutton,\ninput,\noptgroup,\nselect,\ntextarea {\n  color: inherit; /* 1 */\n  font: inherit; /* 2 */\n  margin: 0; /* 3 */\n}\n\n/**\n * Address `overflow` set to `hidden` in IE 8/9/10/11.\n */\n\nbutton {\n  overflow: visible;\n}\n\n/**\n * Address inconsistent `text-transform` inheritance for `button` and `select`.\n * All other form control elements do not inherit `text-transform` values.\n * Correct `button` style inheritance in Firefox, IE 8/9/10/11, and Opera.\n * Correct `select` style inheritance in Firefox.\n */\n\nbutton,\nselect {\n  text-transform: none;\n}\n\n/**\n * 1. Avoid the WebKit bug in Android 4.0.* where (2) destroys native `audio`\n *    and `video` controls.\n * 2. Correct inability to style clickable `input` types in iOS.\n * 3. Improve usability and consistency of cursor style between image-type\n *    `input` and others.\n */\n\nbutton,\nhtml input[type=\"button\"], /* 1 */\ninput[type=\"reset\"],\ninput[type=\"submit\"] {\n  -webkit-appearance: button; /* 2 */\n  cursor: pointer; /* 3 */\n}\n\n/**\n * Re-set default cursor for disabled elements.\n */\n\nbutton[disabled],\nhtml input[disabled] {\n  cursor: default;\n}\n\n/**\n * Remove inner padding and border in Firefox 4+.\n */\n\nbutton::-moz-focus-inner,\ninput::-moz-focus-inner {\n  border: 0;\n  padding: 0;\n}\n\n/**\n * Address Firefox 4+ setting `line-height` on `input` using `!important` in\n * the UA stylesheet.\n */\n\ninput {\n  line-height: normal;\n}\n\n/**\n * It's recommended that you don't attempt to style these elements.\n * Firefox's implementation doesn't respect box-sizing, padding, or width.\n *\n * 1. Address box sizing set to `content-box` in IE 8/9/10.\n * 2. Remove excess padding in IE 8/9/10.\n */\n\ninput[type=\"checkbox\"],\ninput[type=\"radio\"] {\n  box-sizing: border-box; /* 1 */\n  padding: 0; /* 2 */\n}\n\n/**\n * Fix the cursor style for Chrome's increment/decrement buttons. For certain\n * `font-size` values of the `input`, it causes the cursor style of the\n * decrement button to change from `default` to `text`.\n */\n\ninput[type=\"number\"]::-webkit-inner-spin-button,\ninput[type=\"number\"]::-webkit-outer-spin-button {\n  height: auto;\n}\n\n/**\n * 1. Address `appearance` set to `searchfield` in Safari and Chrome.\n * 2. Address `box-sizing` set to `border-box` in Safari and Chrome.\n */\n\ninput[type=\"search\"] {\n  -webkit-appearance: textfield; /* 1 */\n  box-sizing: content-box; /* 2 */\n}\n\n/**\n * Remove inner padding and search cancel button in Safari and Chrome on OS X.\n * Safari (but not Chrome) clips the cancel button when the search input has\n * padding (and `textfield` appearance).\n */\n\ninput[type=\"search\"]::-webkit-search-cancel-button,\ninput[type=\"search\"]::-webkit-search-decoration {\n  -webkit-appearance: none;\n}\n\n/**\n * Define consistent border, margin, and padding.\n */\n\nfieldset {\n  border: 1px solid #c0c0c0;\n  margin: 0 2px;\n  padding: 0.35em 0.625em 0.75em;\n}\n\n/**\n * 1. Correct `color` not being inherited in IE 8/9/10/11.\n * 2. Remove padding so people aren't caught out if they zero out fieldsets.\n */\n\nlegend {\n  border: 0; /* 1 */\n  padding: 0; /* 2 */\n}\n\n/**\n * Remove default vertical scrollbar in IE 8/9/10/11.\n */\n\ntextarea {\n  overflow: auto;\n}\n\n/**\n * Don't inherit the `font-weight` (applied by a rule above).\n * NOTE: the default cannot safely be changed in Chrome and Safari on OS X.\n */\n\noptgroup {\n  font-weight: bold;\n}\n\n/* Tables\n   ========================================================================== */\n\n/**\n * Remove most spacing between table cells.\n */\n\ntable {\n  border-collapse: collapse;\n  border-spacing: 0;\n}\n\ntd,\nth {\n  padding: 0;\n}\n"; (require("./../cssify"))(css); module.exports = css;
},{"./../cssify":10}],19:[function(require,module,exports){
module.exports = require('cssify');
},{"cssify":10}],20:[function(require,module,exports){
/**
 * Module dependencies.
 */

var Emitter = require('emitter');
var reduce = require('reduce');

/**
 * Root reference for iframes.
 */

var root = 'undefined' == typeof window
  ? (this || self)
  : window;

/**
 * Noop.
 */

function noop(){};

/**
 * Check if `obj` is a host object,
 * we don't want to serialize these :)
 *
 * TODO: future proof, move to compoent land
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isHost(obj) {
  var str = {}.toString.call(obj);

  switch (str) {
    case '[object File]':
    case '[object Blob]':
    case '[object FormData]':
      return true;
    default:
      return false;
  }
}

/**
 * Determine XHR.
 */

request.getXHR = function () {
  if (root.XMLHttpRequest
      && (!root.location || 'file:' != root.location.protocol
          || !root.ActiveXObject)) {
    return new XMLHttpRequest;
  } else {
    try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch(e) {}
  }
  return false;
};

/**
 * Removes leading and trailing whitespace, added to support IE.
 *
 * @param {String} s
 * @return {String}
 * @api private
 */

var trim = ''.trim
  ? function(s) { return s.trim(); }
  : function(s) { return s.replace(/(^\s*|\s*$)/g, ''); };

/**
 * Check if `obj` is an object.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isObject(obj) {
  return obj === Object(obj);
}

/**
 * Serialize the given `obj`.
 *
 * @param {Object} obj
 * @return {String}
 * @api private
 */

function serialize(obj) {
  if (!isObject(obj)) return obj;
  var pairs = [];
  for (var key in obj) {
    if (null != obj[key]) {
      pairs.push(encodeURIComponent(key)
        + '=' + encodeURIComponent(obj[key]));
    }
  }
  return pairs.join('&');
}

/**
 * Expose serialization method.
 */

 request.serializeObject = serialize;

 /**
  * Parse the given x-www-form-urlencoded `str`.
  *
  * @param {String} str
  * @return {Object}
  * @api private
  */

function parseString(str) {
  var obj = {};
  var pairs = str.split('&');
  var parts;
  var pair;

  for (var i = 0, len = pairs.length; i < len; ++i) {
    pair = pairs[i];
    parts = pair.split('=');
    obj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
  }

  return obj;
}

/**
 * Expose parser.
 */

request.parseString = parseString;

/**
 * Default MIME type map.
 *
 *     superagent.types.xml = 'application/xml';
 *
 */

request.types = {
  html: 'text/html',
  json: 'application/json',
  xml: 'application/xml',
  urlencoded: 'application/x-www-form-urlencoded',
  'form': 'application/x-www-form-urlencoded',
  'form-data': 'application/x-www-form-urlencoded'
};

/**
 * Default serialization map.
 *
 *     superagent.serialize['application/xml'] = function(obj){
 *       return 'generated xml here';
 *     };
 *
 */

 request.serialize = {
   'application/x-www-form-urlencoded': serialize,
   'application/json': JSON.stringify
 };

 /**
  * Default parsers.
  *
  *     superagent.parse['application/xml'] = function(str){
  *       return { object parsed from str };
  *     };
  *
  */

request.parse = {
  'application/x-www-form-urlencoded': parseString,
  'application/json': JSON.parse
};

/**
 * Parse the given header `str` into
 * an object containing the mapped fields.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function parseHeader(str) {
  var lines = str.split(/\r?\n/);
  var fields = {};
  var index;
  var line;
  var field;
  var val;

  lines.pop(); // trailing CRLF

  for (var i = 0, len = lines.length; i < len; ++i) {
    line = lines[i];
    index = line.indexOf(':');
    field = line.slice(0, index).toLowerCase();
    val = trim(line.slice(index + 1));
    fields[field] = val;
  }

  return fields;
}

/**
 * Return the mime type for the given `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function type(str){
  return str.split(/ *; */).shift();
};

/**
 * Return header field parameters.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function params(str){
  return reduce(str.split(/ *; */), function(obj, str){
    var parts = str.split(/ *= */)
      , key = parts.shift()
      , val = parts.shift();

    if (key && val) obj[key] = val;
    return obj;
  }, {});
};

/**
 * Initialize a new `Response` with the given `xhr`.
 *
 *  - set flags (.ok, .error, etc)
 *  - parse header
 *
 * Examples:
 *
 *  Aliasing `superagent` as `request` is nice:
 *
 *      request = superagent;
 *
 *  We can use the promise-like API, or pass callbacks:
 *
 *      request.get('/').end(function(res){});
 *      request.get('/', function(res){});
 *
 *  Sending data can be chained:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' })
 *        .end(function(res){});
 *
 *  Or passed to `.send()`:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' }, function(res){});
 *
 *  Or passed to `.post()`:
 *
 *      request
 *        .post('/user', { name: 'tj' })
 *        .end(function(res){});
 *
 * Or further reduced to a single call for simple cases:
 *
 *      request
 *        .post('/user', { name: 'tj' }, function(res){});
 *
 * @param {XMLHTTPRequest} xhr
 * @param {Object} options
 * @api private
 */

function Response(req, options) {
  options = options || {};
  this.req = req;
  this.xhr = this.req.xhr;
  // responseText is accessible only if responseType is '' or 'text' and on older browsers
  this.text = ((this.req.method !='HEAD' && (this.xhr.responseType === '' || this.xhr.responseType === 'text')) || typeof this.xhr.responseType === 'undefined')
     ? this.xhr.responseText
     : null;
  this.statusText = this.req.xhr.statusText;
  this.setStatusProperties(this.xhr.status);
  this.header = this.headers = parseHeader(this.xhr.getAllResponseHeaders());
  // getAllResponseHeaders sometimes falsely returns "" for CORS requests, but
  // getResponseHeader still works. so we get content-type even if getting
  // other headers fails.
  this.header['content-type'] = this.xhr.getResponseHeader('content-type');
  this.setHeaderProperties(this.header);
  this.body = this.req.method != 'HEAD'
    ? this.parseBody(this.text ? this.text : this.xhr.response)
    : null;
}

/**
 * Get case-insensitive `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api public
 */

Response.prototype.get = function(field){
  return this.header[field.toLowerCase()];
};

/**
 * Set header related properties:
 *
 *   - `.type` the content type without params
 *
 * A response of "Content-Type: text/plain; charset=utf-8"
 * will provide you with a `.type` of "text/plain".
 *
 * @param {Object} header
 * @api private
 */

Response.prototype.setHeaderProperties = function(header){
  // content-type
  var ct = this.header['content-type'] || '';
  this.type = type(ct);

  // params
  var obj = params(ct);
  for (var key in obj) this[key] = obj[key];
};

/**
 * Parse the given body `str`.
 *
 * Used for auto-parsing of bodies. Parsers
 * are defined on the `superagent.parse` object.
 *
 * @param {String} str
 * @return {Mixed}
 * @api private
 */

Response.prototype.parseBody = function(str){
  var parse = request.parse[this.type];
  return parse && str && (str.length || str instanceof Object)
    ? parse(str)
    : null;
};

/**
 * Set flags such as `.ok` based on `status`.
 *
 * For example a 2xx response will give you a `.ok` of __true__
 * whereas 5xx will be __false__ and `.error` will be __true__. The
 * `.clientError` and `.serverError` are also available to be more
 * specific, and `.statusType` is the class of error ranging from 1..5
 * sometimes useful for mapping respond colors etc.
 *
 * "sugar" properties are also defined for common cases. Currently providing:
 *
 *   - .noContent
 *   - .badRequest
 *   - .unauthorized
 *   - .notAcceptable
 *   - .notFound
 *
 * @param {Number} status
 * @api private
 */

Response.prototype.setStatusProperties = function(status){
  // handle IE9 bug: http://stackoverflow.com/questions/10046972/msie-returns-status-code-of-1223-for-ajax-request
  if (status === 1223) {
    status = 204;
  }

  var type = status / 100 | 0;

  // status / class
  this.status = status;
  this.statusType = type;

  // basics
  this.info = 1 == type;
  this.ok = 2 == type;
  this.clientError = 4 == type;
  this.serverError = 5 == type;
  this.error = (4 == type || 5 == type)
    ? this.toError()
    : false;

  // sugar
  this.accepted = 202 == status;
  this.noContent = 204 == status;
  this.badRequest = 400 == status;
  this.unauthorized = 401 == status;
  this.notAcceptable = 406 == status;
  this.notFound = 404 == status;
  this.forbidden = 403 == status;
};

/**
 * Return an `Error` representative of this response.
 *
 * @return {Error}
 * @api public
 */

Response.prototype.toError = function(){
  var req = this.req;
  var method = req.method;
  var url = req.url;

  var msg = 'cannot ' + method + ' ' + url + ' (' + this.status + ')';
  var err = new Error(msg);
  err.status = this.status;
  err.method = method;
  err.url = url;

  return err;
};

/**
 * Expose `Response`.
 */

request.Response = Response;

/**
 * Initialize a new `Request` with the given `method` and `url`.
 *
 * @param {String} method
 * @param {String} url
 * @api public
 */

function Request(method, url) {
  var self = this;
  Emitter.call(this);
  this._query = this._query || [];
  this.method = method;
  this.url = url;
  this.header = {};
  this._header = {};
  this.on('end', function(){
    var err = null;
    var res = null;

    try {
      res = new Response(self);
    } catch(e) {
      err = new Error('Parser is unable to parse the response');
      err.parse = true;
      err.original = e;
      return self.callback(err);
    }

    self.emit('response', res);

    if (err) {
      return self.callback(err, res);
    }

    if (res.status >= 200 && res.status < 300) {
      return self.callback(err, res);
    }

    var new_err = new Error(res.statusText || 'Unsuccessful HTTP response');
    new_err.original = err;
    new_err.response = res;
    new_err.status = res.status;

    self.callback(new_err, res);
  });
}

/**
 * Mixin `Emitter`.
 */

Emitter(Request.prototype);

/**
 * Allow for extension
 */

Request.prototype.use = function(fn) {
  fn(this);
  return this;
}

/**
 * Set timeout to `ms`.
 *
 * @param {Number} ms
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.timeout = function(ms){
  this._timeout = ms;
  return this;
};

/**
 * Clear previous timeout.
 *
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.clearTimeout = function(){
  this._timeout = 0;
  clearTimeout(this._timer);
  return this;
};

/**
 * Abort the request, and clear potential timeout.
 *
 * @return {Request}
 * @api public
 */

Request.prototype.abort = function(){
  if (this.aborted) return;
  this.aborted = true;
  this.xhr.abort();
  this.clearTimeout();
  this.emit('abort');
  return this;
};

/**
 * Set header `field` to `val`, or multiple fields with one object.
 *
 * Examples:
 *
 *      req.get('/')
 *        .set('Accept', 'application/json')
 *        .set('X-API-Key', 'foobar')
 *        .end(callback);
 *
 *      req.get('/')
 *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
 *        .end(callback);
 *
 * @param {String|Object} field
 * @param {String} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.set = function(field, val){
  if (isObject(field)) {
    for (var key in field) {
      this.set(key, field[key]);
    }
    return this;
  }
  this._header[field.toLowerCase()] = val;
  this.header[field] = val;
  return this;
};

/**
 * Remove header `field`.
 *
 * Example:
 *
 *      req.get('/')
 *        .unset('User-Agent')
 *        .end(callback);
 *
 * @param {String} field
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.unset = function(field){
  delete this._header[field.toLowerCase()];
  delete this.header[field];
  return this;
};

/**
 * Get case-insensitive header `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api private
 */

Request.prototype.getHeader = function(field){
  return this._header[field.toLowerCase()];
};

/**
 * Set Content-Type to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.xml = 'application/xml';
 *
 *      request.post('/')
 *        .type('xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 *      request.post('/')
 *        .type('application/xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 * @param {String} type
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.type = function(type){
  this.set('Content-Type', request.types[type] || type);
  return this;
};

/**
 * Set Accept to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.json = 'application/json';
 *
 *      request.get('/agent')
 *        .accept('json')
 *        .end(callback);
 *
 *      request.get('/agent')
 *        .accept('application/json')
 *        .end(callback);
 *
 * @param {String} accept
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.accept = function(type){
  this.set('Accept', request.types[type] || type);
  return this;
};

/**
 * Set Authorization field value with `user` and `pass`.
 *
 * @param {String} user
 * @param {String} pass
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.auth = function(user, pass){
  var str = btoa(user + ':' + pass);
  this.set('Authorization', 'Basic ' + str);
  return this;
};

/**
* Add query-string `val`.
*
* Examples:
*
*   request.get('/shoes')
*     .query('size=10')
*     .query({ color: 'blue' })
*
* @param {Object|String} val
* @return {Request} for chaining
* @api public
*/

Request.prototype.query = function(val){
  if ('string' != typeof val) val = serialize(val);
  if (val) this._query.push(val);
  return this;
};

/**
 * Write the field `name` and `val` for "multipart/form-data"
 * request bodies.
 *
 * ``` js
 * request.post('/upload')
 *   .field('foo', 'bar')
 *   .end(callback);
 * ```
 *
 * @param {String} name
 * @param {String|Blob|File} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.field = function(name, val){
  if (!this._formData) this._formData = new root.FormData();
  this._formData.append(name, val);
  return this;
};

/**
 * Queue the given `file` as an attachment to the specified `field`,
 * with optional `filename`.
 *
 * ``` js
 * request.post('/upload')
 *   .attach(new Blob(['<a id="a"><b id="b">hey!</b></a>'], { type: "text/html"}))
 *   .end(callback);
 * ```
 *
 * @param {String} field
 * @param {Blob|File} file
 * @param {String} filename
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.attach = function(field, file, filename){
  if (!this._formData) this._formData = new root.FormData();
  this._formData.append(field, file, filename);
  return this;
};

/**
 * Send `data`, defaulting the `.type()` to "json" when
 * an object is given.
 *
 * Examples:
 *
 *       // querystring
 *       request.get('/search')
 *         .end(callback)
 *
 *       // multiple data "writes"
 *       request.get('/search')
 *         .send({ search: 'query' })
 *         .send({ range: '1..5' })
 *         .send({ order: 'desc' })
 *         .end(callback)
 *
 *       // manual json
 *       request.post('/user')
 *         .type('json')
 *         .send('{"name":"tj"})
 *         .end(callback)
 *
 *       // auto json
 *       request.post('/user')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // manual x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send('name=tj')
 *         .end(callback)
 *
 *       // auto x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // defaults to x-www-form-urlencoded
  *      request.post('/user')
  *        .send('name=tobi')
  *        .send('species=ferret')
  *        .end(callback)
 *
 * @param {String|Object} data
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.send = function(data){
  var obj = isObject(data);
  var type = this.getHeader('Content-Type');

  // merge
  if (obj && isObject(this._data)) {
    for (var key in data) {
      this._data[key] = data[key];
    }
  } else if ('string' == typeof data) {
    if (!type) this.type('form');
    type = this.getHeader('Content-Type');
    if ('application/x-www-form-urlencoded' == type) {
      this._data = this._data
        ? this._data + '&' + data
        : data;
    } else {
      this._data = (this._data || '') + data;
    }
  } else {
    this._data = data;
  }

  if (!obj || isHost(data)) return this;
  if (!type) this.type('json');
  return this;
};

/**
 * Invoke the callback with `err` and `res`
 * and handle arity check.
 *
 * @param {Error} err
 * @param {Response} res
 * @api private
 */

Request.prototype.callback = function(err, res){
  var fn = this._callback;
  this.clearTimeout();
  fn(err, res);
};

/**
 * Invoke callback with x-domain error.
 *
 * @api private
 */

Request.prototype.crossDomainError = function(){
  var err = new Error('Origin is not allowed by Access-Control-Allow-Origin');
  err.crossDomain = true;
  this.callback(err);
};

/**
 * Invoke callback with timeout error.
 *
 * @api private
 */

Request.prototype.timeoutError = function(){
  var timeout = this._timeout;
  var err = new Error('timeout of ' + timeout + 'ms exceeded');
  err.timeout = timeout;
  this.callback(err);
};

/**
 * Enable transmission of cookies with x-domain requests.
 *
 * Note that for this to work the origin must not be
 * using "Access-Control-Allow-Origin" with a wildcard,
 * and also must set "Access-Control-Allow-Credentials"
 * to "true".
 *
 * @api public
 */

Request.prototype.withCredentials = function(){
  this._withCredentials = true;
  return this;
};

/**
 * Initiate request, invoking callback `fn(res)`
 * with an instanceof `Response`.
 *
 * @param {Function} fn
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.end = function(fn){
  var self = this;
  var xhr = this.xhr = request.getXHR();
  var query = this._query.join('&');
  var timeout = this._timeout;
  var data = this._formData || this._data;

  // store callback
  this._callback = fn || noop;

  // state change
  xhr.onreadystatechange = function(){
    if (4 != xhr.readyState) return;

    // In IE9, reads to any property (e.g. status) off of an aborted XHR will
    // result in the error "Could not complete the operation due to error c00c023f"
    var status;
    try { status = xhr.status } catch(e) { status = 0; }

    if (0 == status) {
      if (self.timedout) return self.timeoutError();
      if (self.aborted) return;
      return self.crossDomainError();
    }
    self.emit('end');
  };

  // progress
  var handleProgress = function(e){
    if (e.total > 0) {
      e.percent = e.loaded / e.total * 100;
    }
    self.emit('progress', e);
  };
  if (this.hasListeners('progress')) {
    xhr.onprogress = handleProgress;
  }
  try {
    if (xhr.upload && this.hasListeners('progress')) {
      xhr.upload.onprogress = handleProgress;
    }
  } catch(e) {
    // Accessing xhr.upload fails in IE from a web worker, so just pretend it doesn't exist.
    // Reported here:
    // https://connect.microsoft.com/IE/feedback/details/837245/xmlhttprequest-upload-throws-invalid-argument-when-used-from-web-worker-context
  }

  // timeout
  if (timeout && !this._timer) {
    this._timer = setTimeout(function(){
      self.timedout = true;
      self.abort();
    }, timeout);
  }

  // querystring
  if (query) {
    query = request.serializeObject(query);
    this.url += ~this.url.indexOf('?')
      ? '&' + query
      : '?' + query;
  }

  // initiate request
  xhr.open(this.method, this.url, true);

  // CORS
  if (this._withCredentials) xhr.withCredentials = true;

  // body
  if ('GET' != this.method && 'HEAD' != this.method && 'string' != typeof data && !isHost(data)) {
    // serialize stuff
    var contentType = this.getHeader('Content-Type');
    var serialize = request.serialize[contentType ? contentType.split(';')[0] : ''];
    if (serialize) data = serialize(data);
  }

  // set header fields
  for (var field in this.header) {
    if (null == this.header[field]) continue;
    xhr.setRequestHeader(field, this.header[field]);
  }

  // send stuff
  this.emit('request', this);
  xhr.send(data);
  return this;
};

/**
 * Faux promise support
 *
 * @param {Function} fulfill
 * @param {Function} reject
 * @return {Request}
 */

Request.prototype.then = function (fulfill, reject) {
  return this.end(function(err, res) {
    err ? reject(err) : fulfill(res);
  });
}

/**
 * Expose `Request`.
 */

request.Request = Request;

/**
 * Issue a request:
 *
 * Examples:
 *
 *    request('GET', '/users').end(callback)
 *    request('/users').end(callback)
 *    request('/users', callback)
 *
 * @param {String} method
 * @param {String|Function} url or callback
 * @return {Request}
 * @api public
 */

function request(method, url) {
  // callback
  if ('function' == typeof url) {
    return new Request('GET', method).end(url);
  }

  // url first
  if (1 == arguments.length) {
    return new Request('GET', method);
  }

  return new Request(method, url);
}

/**
 * GET `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.get = function(url, data, fn){
  var req = request('GET', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.query(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * HEAD `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.head = function(url, data, fn){
  var req = request('HEAD', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * DELETE `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.del = function(url, fn){
  var req = request('DELETE', url);
  if (fn) req.end(fn);
  return req;
};

/**
 * PATCH `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.patch = function(url, data, fn){
  var req = request('PATCH', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * POST `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.post = function(url, data, fn){
  var req = request('POST', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * PUT `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.put = function(url, data, fn){
  var req = request('PUT', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * Expose `request`.
 */

module.exports = request;

},{"emitter":21,"reduce":22}],21:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],22:[function(require,module,exports){

/**
 * Reduce `arr` with `fn`.
 *
 * @param {Array} arr
 * @param {Function} fn
 * @param {Mixed} initial
 *
 * TODO: combatible error handling?
 */

module.exports = function(arr, fn, initial){  
  var idx = 0;
  var len = arr.length;
  var curr = arguments.length == 3
    ? initial
    : arr[idx++];

  while (idx < len) {
    curr = fn.call(null, curr, arr[idx], ++idx, arr);
  }
  
  return curr;
};
},{}],23:[function(require,module,exports){
/*!
* vdom-virtualize
* Copyright 2014 by Marcel Klehr <mklehr@gmx.net>
*
* (MIT LICENSE)
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
*/
var VNode = require("virtual-dom/vnode/vnode")
  , VText = require("virtual-dom/vnode/vtext")

module.exports = createVNode

function createVNode(domNode, key) {
  key = key || null // XXX: Leave out `key` for now... merely used for (re-)ordering

  if(domNode.nodeType == 1) return createFromElement(domNode, key)
  if(domNode.nodeType == 3) return createFromTextNode(domNode, key)
  return
}

createVNode.fromHTML = function(html, key) {
  var domNode = document.createElement('div'); // create container
  domNode.innerHTML = html; // browser parses HTML into DOM tree
  var child = domNode.children.length ? domNode.children[0] : domNode.firstChild;
  return createVNode(child, key);
};

function createFromTextNode(tNode) {
  return new VText(tNode.nodeValue)
}


function createFromElement(el) {
  var tagName = el.tagName
  , namespace = el.namespaceURI == 'http://www.w3.org/1999/xhtml'? null : el.namespaceURI
  , properties = getElementProperties(el)
  , children = []

  for (var i = 0; i < el.childNodes.length; i++) {
    children.push(createVNode(el.childNodes[i]/*, i*/))
  }

  return new VNode(tagName, properties, children, null, namespace)
}


function getElementProperties(el) {
  var obj = {}

  props.forEach(function(propName) {
    if(!el[propName]) return

    // Special case: style
    // .style is a DOMStyleDeclaration, thus we need to iterate over all
    // rules to create a hash of applied css properties.
    //
    // You can directly set a specific .style[prop] = value so patching with vdom
    // is possible.
    if("style" == propName) {
      var css = {}
        , styleProp
      if (el.style.length) {
        for(var i=0; i<el.style.length; i++) {
          styleProp = el.style[i]
          css[styleProp] = el.style.getPropertyValue(styleProp) // XXX: add support for "!important" via getPropertyPriority()!
        }
      } else { // IE8
        for (var styleProp in el.style) {
          if (el.style[styleProp]) {
            css[styleProp] = el.style[styleProp];
          }
        }
      }

      obj[propName] = css
      return
    }

    // https://msdn.microsoft.com/en-us/library/cc848861%28v=vs.85%29.aspx
    // The img element does not support the HREF content attribute.
    // In addition, the href property is read-only for the img Document Object Model (DOM) object
    if (el.tagName.toLowerCase() === 'img' && propName === 'href') {
      return;
    }

    // Special case: dataset
    // we can iterate over .dataset with a simple for..in loop.
    // The all-time foo with data-* attribs is the dash-snake to camelCase
    // conversion.
    //
    // *This is compatible with h(), but not with every browser, thus this section was removed in favor
    // of attributes (specified below)!*
    //
    // .dataset properties are directly accessible as transparent getters/setters, so
    // patching with vdom is possible.
    /*if("dataset" == propName) {
      var data = {}
      for(var p in el.dataset) {
        data[p] = el.dataset[p]
      }
      obj[propName] = data
      return
    }*/

    // Special case: attributes
    // these are a NamedNodeMap, but we can just convert them to a hash for vdom,
    // because of https://github.com/Matt-Esch/virtual-dom/blob/master/vdom/apply-properties.js#L57
    if("attributes" == propName){
      var atts = Array.prototype.slice.call(el[propName]);
      var hash = atts.reduce(function(o,a){
        var name = a.name;
        if(obj[name]) return o;
        o[name] = el.getAttribute(a.name);
        return o;
      },{});
      return obj[propName] = hash;
    }
    if("tabIndex" == propName && el.tabIndex === -1) return

    // Special case: contentEditable
    // browser use 'inherit' by default on all nodes, but does not allow setting it to ''
    // diffing virtualize dom will trigger error
    // ref: https://github.com/Matt-Esch/virtual-dom/issues/176
    if("contentEditable" == propName && el[propName] === 'inherit') return

    if('object' === typeof el[propName]) return

    // default: just copy the property
    obj[propName] = el[propName]
    return
  })

  return obj
}

/**
 * DOMNode property white list
 * Taken from https://github.com/Raynos/react/blob/dom-property-config/src/browser/ui/dom/DefaultDOMPropertyConfig.js
 */
var props =

module.exports.properties = [
 "accept"
,"accessKey"
,"action"
,"alt"
,"async"
,"autoComplete"
,"autoPlay"
,"cellPadding"
,"cellSpacing"
,"checked"
,"className"
,"colSpan"
,"content"
,"contentEditable"
,"controls"
,"crossOrigin"
,"data"
//,"dataset" removed since attributes handles data-attributes
,"defer"
,"dir"
,"download"
,"draggable"
,"encType"
,"formNoValidate"
,"href"
,"hrefLang"
,"htmlFor"
,"httpEquiv"
,"icon"
,"id"
,"label"
,"lang"
,"list"
,"loop"
,"max"
,"mediaGroup"
,"method"
,"min"
,"multiple"
,"muted"
,"name"
,"noValidate"
,"pattern"
,"placeholder"
,"poster"
,"preload"
,"radioGroup"
,"readOnly"
,"rel"
,"required"
,"rowSpan"
,"sandbox"
,"scope"
,"scrollLeft"
,"scrolling"
,"scrollTop"
,"selected"
,"span"
,"spellCheck"
,"src"
,"srcDoc"
,"srcSet"
,"start"
,"step"
,"style"
,"tabIndex"
,"target"
,"title"
,"type"
,"value"

// Non-standard Properties
,"autoCapitalize"
,"autoCorrect"
,"property"

, "attributes"
]

var attrs =
module.exports.attrs = [
 "allowFullScreen"
,"allowTransparency"
,"charSet"
,"cols"
,"contextMenu"
,"dateTime"
,"disabled"
,"form"
,"frameBorder"
,"height"
,"hidden"
,"maxLength"
,"role"
,"rows"
,"seamless"
,"size"
,"width"
,"wmode"

// SVG Properties
,"cx"
,"cy"
,"d"
,"dx"
,"dy"
,"fill"
,"fx"
,"fy"
,"gradientTransform"
,"gradientUnits"
,"offset"
,"points"
,"r"
,"rx"
,"ry"
,"spreadMethod"
,"stopColor"
,"stopOpacity"
,"stroke"
,"strokeLinecap"
,"strokeWidth"
,"textAnchor"
,"transform"
,"version"
,"viewBox"
,"x1"
,"x2"
,"x"
,"y1"
,"y2"
,"y"
]

},{"virtual-dom/vnode/vnode":29,"virtual-dom/vnode/vtext":30}],24:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],25:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],26:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":28}],27:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],28:[function(require,module,exports){
module.exports = "2"

},{}],29:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":24,"./is-vhook":25,"./is-vnode":26,"./is-widget":27,"./version":28}],30:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":28}],31:[function(require,module,exports){
var createElement = require("./vdom/create-element.js")

module.exports = createElement

},{"./vdom/create-element.js":44}],32:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":64}],33:[function(require,module,exports){
var h = require("./virtual-hyperscript/index.js")

module.exports = h

},{"./virtual-hyperscript/index.js":51}],34:[function(require,module,exports){
var diff = require("./diff.js")
var patch = require("./patch.js")
var h = require("./h.js")
var create = require("./create-element.js")
var VNode = require('./vnode/vnode.js')
var VText = require('./vnode/vtext.js')

module.exports = {
    diff: diff,
    patch: patch,
    h: h,
    create: create,
    VNode: VNode,
    VText: VText
}

},{"./create-element.js":31,"./diff.js":32,"./h.js":33,"./patch.js":42,"./vnode/vnode.js":60,"./vnode/vtext.js":62}],35:[function(require,module,exports){
/*!
 * Cross-Browser Split 1.1.1
 * Copyright 2007-2012 Steven Levithan <stevenlevithan.com>
 * Available under the MIT License
 * ECMAScript compliant, uniform cross-browser split method
 */

/**
 * Splits a string into an array of strings using a regex or string separator. Matches of the
 * separator are not included in the result array. However, if `separator` is a regex that contains
 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
 * cross-browser.
 * @param {String} str String to split.
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 * @example
 *
 * // Basic use
 * split('a b c d', ' ');
 * // -> ['a', 'b', 'c', 'd']
 *
 * // With limit
 * split('a b c d', ' ', 2);
 * // -> ['a', 'b']
 *
 * // Backreferences in result array
 * split('..word1 word2..', /([a-z]+)(\d+)/i);
 * // -> ['..', 'word', '1', ' ', 'word', '2', '..']
 */
module.exports = (function split(undef) {

  var nativeSplit = String.prototype.split,
    compliantExecNpcg = /()??/.exec("")[1] === undef,
    // NPCG: nonparticipating capturing group
    self;

  self = function(str, separator, limit) {
    // If `separator` is not a regex, use `nativeSplit`
    if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
      return nativeSplit.call(str, separator, limit);
    }
    var output = [],
      flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.extended ? "x" : "") + // Proposed for ES6
      (separator.sticky ? "y" : ""),
      // Firefox 3+
      lastLastIndex = 0,
      // Make `global` and avoid `lastIndex` issues by working with a copy
      separator = new RegExp(separator.source, flags + "g"),
      separator2, match, lastIndex, lastLength;
    str += ""; // Type-convert
    if (!compliantExecNpcg) {
      // Doesn't need flags gy, but they don't hurt
      separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
    }
    /* Values for `limit`, per the spec:
     * If undefined: 4294967295 // Math.pow(2, 32) - 1
     * If 0, Infinity, or NaN: 0
     * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
     * If negative number: 4294967296 - Math.floor(Math.abs(limit))
     * If other: Type-convert, then use the above rules
     */
    limit = limit === undef ? -1 >>> 0 : // Math.pow(2, 32) - 1
    limit >>> 0; // ToUint32(limit)
    while (match = separator.exec(str)) {
      // `separator.lastIndex` is not reliable cross-browser
      lastIndex = match.index + match[0].length;
      if (lastIndex > lastLastIndex) {
        output.push(str.slice(lastLastIndex, match.index));
        // Fix browsers whose `exec` methods don't consistently return `undefined` for
        // nonparticipating capturing groups
        if (!compliantExecNpcg && match.length > 1) {
          match[0].replace(separator2, function() {
            for (var i = 1; i < arguments.length - 2; i++) {
              if (arguments[i] === undef) {
                match[i] = undef;
              }
            }
          });
        }
        if (match.length > 1 && match.index < str.length) {
          Array.prototype.push.apply(output, match.slice(1));
        }
        lastLength = match[0].length;
        lastLastIndex = lastIndex;
        if (output.length >= limit) {
          break;
        }
      }
      if (separator.lastIndex === match.index) {
        separator.lastIndex++; // Avoid an infinite loop
      }
    }
    if (lastLastIndex === str.length) {
      if (lastLength || !separator.test("")) {
        output.push("");
      }
    } else {
      output.push(str.slice(lastLastIndex));
    }
    return output.length > limit ? output.slice(0, limit) : output;
  };

  return self;
})();

},{}],36:[function(require,module,exports){
'use strict';

var OneVersionConstraint = require('individual/one-version');

var MY_VERSION = '7';
OneVersionConstraint('ev-store', MY_VERSION);

var hashKey = '__EV_STORE_KEY@' + MY_VERSION;

module.exports = EvStore;

function EvStore(elem) {
    var hash = elem[hashKey];

    if (!hash) {
        hash = elem[hashKey] = {};
    }

    return hash;
}

},{"individual/one-version":38}],37:[function(require,module,exports){
(function (global){
'use strict';

/*global window, global*/

var root = typeof window !== 'undefined' ?
    window : typeof global !== 'undefined' ?
    global : {};

module.exports = Individual;

function Individual(key, value) {
    if (key in root) {
        return root[key];
    }

    root[key] = value;

    return value;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],38:[function(require,module,exports){
'use strict';

var Individual = require('./index.js');

module.exports = OneVersion;

function OneVersion(moduleName, version, defaultValue) {
    var key = '__INDIVIDUAL_ONE_VERSION_' + moduleName;
    var enforceKey = key + '_ENFORCE_SINGLETON';

    var versionValue = Individual(enforceKey, version);

    if (versionValue !== version) {
        throw new Error('Can only have one copy of ' +
            moduleName + '.\n' +
            'You already have version ' + versionValue +
            ' installed.\n' +
            'This means you cannot install version ' + version);
    }

    return Individual(key, defaultValue);
}

},{"./index.js":37}],39:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"min-document":2}],40:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],41:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],42:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":47}],43:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":55,"is-object":40}],44:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":53,"../vnode/is-vnode.js":56,"../vnode/is-vtext.js":57,"../vnode/is-widget.js":58,"./apply-properties":43,"global/document":39}],45:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],46:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = renderOptions.render(vText, renderOptions)

        if (parentNode && newNode !== domNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = renderOptions.render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, moves) {
    var childNodes = domNode.childNodes
    var keyMap = {}
    var node
    var remove
    var insert

    for (var i = 0; i < moves.removes.length; i++) {
        remove = moves.removes[i]
        node = childNodes[remove.from]
        if (remove.key) {
            keyMap[remove.key] = node
        }
        domNode.removeChild(node)
    }

    var length = childNodes.length
    for (var j = 0; j < moves.inserts.length; j++) {
        insert = moves.inserts[j]
        node = keyMap[insert.key]
        // this is the weirdest bug i've ever seen in webkit
        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":58,"../vnode/vpatch.js":61,"./apply-properties":43,"./update-widget":48}],47:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var render = require("./create-element")
var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches, renderOptions) {
    renderOptions = renderOptions || {}
    renderOptions.patch = renderOptions.patch && renderOptions.patch !== patch
        ? renderOptions.patch
        : patchRecursive
    renderOptions.render = renderOptions.render || render

    return renderOptions.patch(rootNode, patches, renderOptions)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions.document && ownerDocument !== document) {
        renderOptions.document = ownerDocument
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./create-element":44,"./dom-index":45,"./patch-op":46,"global/document":39,"x-is-array":41}],48:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":58}],49:[function(require,module,exports){
'use strict';

var EvStore = require('ev-store');

module.exports = EvHook;

function EvHook(value) {
    if (!(this instanceof EvHook)) {
        return new EvHook(value);
    }

    this.value = value;
}

EvHook.prototype.hook = function (node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = this.value;
};

EvHook.prototype.unhook = function(node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = undefined;
};

},{"ev-store":36}],50:[function(require,module,exports){
'use strict';

module.exports = SoftSetHook;

function SoftSetHook(value) {
    if (!(this instanceof SoftSetHook)) {
        return new SoftSetHook(value);
    }

    this.value = value;
}

SoftSetHook.prototype.hook = function (node, propertyName) {
    if (node[propertyName] !== this.value) {
        node[propertyName] = this.value;
    }
};

},{}],51:[function(require,module,exports){
'use strict';

var isArray = require('x-is-array');

var VNode = require('../vnode/vnode.js');
var VText = require('../vnode/vtext.js');
var isVNode = require('../vnode/is-vnode');
var isVText = require('../vnode/is-vtext');
var isWidget = require('../vnode/is-widget');
var isHook = require('../vnode/is-vhook');
var isVThunk = require('../vnode/is-thunk');

var parseTag = require('./parse-tag.js');
var softSetHook = require('./hooks/soft-set-hook.js');
var evHook = require('./hooks/ev-hook.js');

module.exports = h;

function h(tagName, properties, children) {
    var childNodes = [];
    var tag, props, key, namespace;

    if (!children && isChildren(properties)) {
        children = properties;
        props = {};
    }

    props = props || properties || {};
    tag = parseTag(tagName, props);

    // support keys
    if (props.hasOwnProperty('key')) {
        key = props.key;
        props.key = undefined;
    }

    // support namespace
    if (props.hasOwnProperty('namespace')) {
        namespace = props.namespace;
        props.namespace = undefined;
    }

    // fix cursor bug
    if (tag === 'INPUT' &&
        !namespace &&
        props.hasOwnProperty('value') &&
        props.value !== undefined &&
        !isHook(props.value)
    ) {
        props.value = softSetHook(props.value);
    }

    transformProperties(props);

    if (children !== undefined && children !== null) {
        addChild(children, childNodes, tag, props);
    }


    return new VNode(tag, props, childNodes, key, namespace);
}

function addChild(c, childNodes, tag, props) {
    if (typeof c === 'string') {
        childNodes.push(new VText(c));
    } else if (typeof c === 'number') {
        childNodes.push(new VText(String(c)));
    } else if (isChild(c)) {
        childNodes.push(c);
    } else if (isArray(c)) {
        for (var i = 0; i < c.length; i++) {
            addChild(c[i], childNodes, tag, props);
        }
    } else if (c === null || c === undefined) {
        return;
    } else {
        throw UnexpectedVirtualElement({
            foreignObject: c,
            parentVnode: {
                tagName: tag,
                properties: props
            }
        });
    }
}

function transformProperties(props) {
    for (var propName in props) {
        if (props.hasOwnProperty(propName)) {
            var value = props[propName];

            if (isHook(value)) {
                continue;
            }

            if (propName.substr(0, 3) === 'ev-') {
                // add ev-foo support
                props[propName] = evHook(value);
            }
        }
    }
}

function isChild(x) {
    return isVNode(x) || isVText(x) || isWidget(x) || isVThunk(x);
}

function isChildren(x) {
    return typeof x === 'string' || isArray(x) || isChild(x);
}

function UnexpectedVirtualElement(data) {
    var err = new Error();

    err.type = 'virtual-hyperscript.unexpected.virtual-element';
    err.message = 'Unexpected virtual child passed to h().\n' +
        'Expected a VNode / Vthunk / VWidget / string but:\n' +
        'got:\n' +
        errorString(data.foreignObject) +
        '.\n' +
        'The parent vnode is:\n' +
        errorString(data.parentVnode)
        '\n' +
        'Suggested fix: change your `h(..., [ ... ])` callsite.';
    err.foreignObject = data.foreignObject;
    err.parentVnode = data.parentVnode;

    return err;
}

function errorString(obj) {
    try {
        return JSON.stringify(obj, null, '    ');
    } catch (e) {
        return String(obj);
    }
}

},{"../vnode/is-thunk":54,"../vnode/is-vhook":55,"../vnode/is-vnode":56,"../vnode/is-vtext":57,"../vnode/is-widget":58,"../vnode/vnode.js":60,"../vnode/vtext.js":62,"./hooks/ev-hook.js":49,"./hooks/soft-set-hook.js":50,"./parse-tag.js":52,"x-is-array":41}],52:[function(require,module,exports){
'use strict';

var split = require('browser-split');

var classIdSplit = /([\.#]?[a-zA-Z0-9\u007F-\uFFFF_:-]+)/;
var notClassId = /^\.|#/;

module.exports = parseTag;

function parseTag(tag, props) {
    if (!tag) {
        return 'DIV';
    }

    var noId = !(props.hasOwnProperty('id'));

    var tagParts = split(tag, classIdSplit);
    var tagName = null;

    if (notClassId.test(tagParts[1])) {
        tagName = 'DIV';
    }

    var classes, part, type, i;

    for (i = 0; i < tagParts.length; i++) {
        part = tagParts[i];

        if (!part) {
            continue;
        }

        type = part.charAt(0);

        if (!tagName) {
            tagName = part;
        } else if (type === '.') {
            classes = classes || [];
            classes.push(part.substring(1, part.length));
        } else if (type === '#' && noId) {
            props.id = part.substring(1, part.length);
        }
    }

    if (classes) {
        if (props.className) {
            classes.push(props.className);
        }

        props.className = classes.join(' ');
    }

    return props.namespace ? tagName : tagName.toUpperCase();
}

},{"browser-split":35}],53:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":54,"./is-vnode":56,"./is-vtext":57,"./is-widget":58}],54:[function(require,module,exports){
arguments[4][24][0].apply(exports,arguments)
},{"dup":24}],55:[function(require,module,exports){
arguments[4][25][0].apply(exports,arguments)
},{"dup":25}],56:[function(require,module,exports){
arguments[4][26][0].apply(exports,arguments)
},{"./version":59,"dup":26}],57:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":59}],58:[function(require,module,exports){
arguments[4][27][0].apply(exports,arguments)
},{"dup":27}],59:[function(require,module,exports){
arguments[4][28][0].apply(exports,arguments)
},{"dup":28}],60:[function(require,module,exports){
arguments[4][29][0].apply(exports,arguments)
},{"./is-thunk":54,"./is-vhook":55,"./is-vnode":56,"./is-widget":58,"./version":59,"dup":29}],61:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":59}],62:[function(require,module,exports){
arguments[4][30][0].apply(exports,arguments)
},{"./version":59,"dup":30}],63:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":55,"is-object":40}],64:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (orderedSet.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {
    // O(M) time, O(M) memory
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // O(M) time
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newChildren.push(newItem)
        }
    }

    var simulate = newChildren.slice()
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    for (var k = 0; k < bChildren.length;) {
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        }
        else {
            simulateIndex++
            k++
        }
    }

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1)

    return {
        from: index,
        key: key
    }
}

function keyIndex(children) {
    var keys = {}
    var free = []
    var length = children.length

    for (var i = 0; i < length; i++) {
        var child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys: keys,     // A hash of key name to index
        free: free      // An array of unkeyed item indices
    }
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":53,"../vnode/is-thunk":54,"../vnode/is-vnode":56,"../vnode/is-vtext":57,"../vnode/is-widget":58,"../vnode/vpatch":61,"./diff-props":63,"x-is-array":41}],65:[function(require,module,exports){
module.exports = extend

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],66:[function(require,module,exports){
'use strict';

var request = require('superagent');

function req() {
	return new Promise(function (resolve, reject) {
		request.get('pages.json').end(function (err, res) {
			if (err) {
				return reject(err);
			}

			resolve(res.body);
		});
	});
}

module.exports = function () /*pwd*/{
	return req();
};

},{"superagent":20}],67:[function(require,module,exports){
'use strict';

var h = require('virtual-dom/h'),
    virtualize = require('vdom-virtualize');

function makeUrl(s, p) {
	var path = '/#';
	path += s;
	if (p) {
		path += '/';
		path += p;
	}

	return path;
}

function matches(path, s, p) {
	path = path || '';
	path = decodeURI(path);
	path = path.slice(2);
	path = path.split('/');

	return path[0] === s && (path[1] === p || p === undefined);
}

function pageNavItem(state, s, page) {
	var className = [];
	if (matches(state.path, s, page)) {
		className.push('selected');
	}

	return h('li', {
		className: className.join(' ')
	}, [h('a', {
		href: makeUrl(s, page)
	}, [page])]);
}

function pageNav(s, pages, state) {
	return h('ol', {
		className: 'section-items'
	}, pages.map(pageNavItem.bind(null, state, s)));
}

function sectionNavItem(name, pages, state) {
	var className = [];
	if (matches(state.path, name)) {
		className.push('selected');
	}
	if (name !== 'Introduction') {
		className.push('section-nav');
	}

	var children = [];

	var props = {};
	if (name !== 'Introduction') {
		props.tabindex = 0;
		children.push(pageNav(name, pages, state));
	} else {
		props.href = makeUrl(name);
	}
	children.unshift(h('a', props, [name]));

	return h('li', {
		className: className.join(' ')
	}, children);
}

function sectionNav(bundle, state) {
	var navItems = [];

	var sections = Object.keys(bundle);

	var _iteratorNormalCompletion = true;
	var _didIteratorError = false;
	var _iteratorError = undefined;

	try {
		for (var _iterator = sections[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
			var section = _step.value;

			navItems.push(sectionNavItem(section, Object.keys(bundle[section]), state));
		}
	} catch (err) {
		_didIteratorError = true;
		_iteratorError = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion && _iterator['return']) {
				_iterator['return']();
			}
		} finally {
			if (_didIteratorError) {
				throw _iteratorError;
			}
		}
	}

	return h('nav', {
		className: 'page-nav'
	}, [h('ol', {}, navItems)]);
}

function page(s, name, content, state) {
	var className = [];
	if (matches(state.path, s, name)) {
		className.push('selected');
	}

	var p = virtualize.fromHTML(content);
	p.properties.className = className.join(' ');

	return p;
}

function sectionArticle(name, pages, state) {
	var className = [];
	if (matches(state.path, name)) {
		className.push('selected');
	}

	var contents = name === 'Introduction' ? page(name, undefined, pages, state) : Object.keys(pages).map(function (p) {
		return page(name, p, pages[p], state);
	});

	var s = h('article', {
		className: className.join(' ')
	}, [h('h2', {}, [name]), contents]);
	return s;
}

function pages(bundle, state) {
	return h('div', {
		className: 'page-content'
	}, Object.keys(bundle).map(function (s) {
		return sectionArticle(s, bundle[s], state);
	}));
}

function things(bundle, state) {
	return h('div', {
		className: 'page-wrapper'
	}, [sectionNav(bundle, state), pages(bundle, state)]);
}

module.exports = things;

},{"vdom-virtualize":23,"virtual-dom/h":33}],68:[function(require,module,exports){
module.exports = require('sassify').byUrl('data:text/css;base64,LyoKJGxpZ2h0ZXItYzogI2ZmZjsKJGxpZ2h0LWM6ICNFOUYzRDk7CiRiYXNlLWM6ICM2NjY2NjY7CiRkYXJrLWM6ICNBMUMyMkQ7CiRkYXJrZXItYzogIzg5QUMxMDsKKi8KLyoKJHByaW1hcnktY29sb3VyOiAjMzMzOwokc2Vjb25kYXJ5LWNvbG91cjogbGlnaHRlbigkcHJpbWFyeS1jb2xvdXIsIDIwJSk7CiRiYWNrZ3JvdW5kLWNvbG91cjogI2VmZjsKKi8KLnBhZ2UtbmF2ID4gb2wgPiBsaS5zZWN0aW9uLW5hdjpub3QoOmhvdmVyKSAuc2VjdGlvbi1pdGVtcywgLnBhZ2UtbmF2IGxpOm5vdCg6aG92ZXIpIC5zZWN0aW9uLWl0ZW1zLCAucGFnZS1jb250ZW50IGFydGljbGU6bm90KC5zZWxlY3RlZCksCi5wYWdlLWNvbnRlbnQgc2VjdGlvbjpub3QoLnNlbGVjdGVkKSwgLnRhc2tib3ggaW5wdXQ6bm90KDpjaGVja2VkKSB+IGJsb2NrcXVvdGUsIC5wYWdlLXRpdGxlIHsKICBwb3NpdGlvbjogYWJzb2x1dGUgIWltcG9ydGFudDsKICBsZWZ0OiAtMTAwMDBweDsKICBvdmVyZmxvdzogaGlkZGVuOwogIHdpZHRoOiAxcHg7CiAgaGVpZ2h0OiAxcHg7IH0KICBbZGlyPSJydGwiXSAucGFnZS1uYXYgPiBvbCA+IGxpLnNlY3Rpb24tbmF2Om5vdCg6aG92ZXIpIC5zZWN0aW9uLWl0ZW1zLCAucGFnZS1uYXYgPiBvbCA+IGxpLnNlY3Rpb24tbmF2Om5vdCg6aG92ZXIpIFtkaXI9InJ0bCJdIC5zZWN0aW9uLWl0ZW1zLCBbZGlyPSJydGwiXSAucGFnZS1uYXYgbGk6bm90KDpob3ZlcikgLnNlY3Rpb24taXRlbXMsIC5wYWdlLW5hdiBsaTpub3QoOmhvdmVyKSBbZGlyPSJydGwiXSAuc2VjdGlvbi1pdGVtcywgW2Rpcj0icnRsIl0gLnBhZ2UtY29udGVudCBhcnRpY2xlOm5vdCguc2VsZWN0ZWQpLCAucGFnZS1jb250ZW50IFtkaXI9InJ0bCJdIGFydGljbGU6bm90KC5zZWxlY3RlZCksCiAgW2Rpcj0icnRsIl0gLnBhZ2UtY29udGVudCBzZWN0aW9uOm5vdCguc2VsZWN0ZWQpLCAucGFnZS1jb250ZW50IFtkaXI9InJ0bCJdIHNlY3Rpb246bm90KC5zZWxlY3RlZCksIFtkaXI9InJ0bCJdIC50YXNrYm94IGlucHV0Om5vdCg6Y2hlY2tlZCkgfiBibG9ja3F1b3RlLCAudGFza2JveCBbZGlyPSJydGwiXSBpbnB1dDpub3QoOmNoZWNrZWQpIH4gYmxvY2txdW90ZSwgW2Rpcj0icnRsIl0gLnBhZ2UtdGl0bGUgewogICAgbGVmdDogYXV0bzsKICAgIHJpZ2h0OiAtMTAwMDBweDsgfQoKLyoKJGxpZ2h0ZXItYzogI2ZmZjsKJGxpZ2h0LWM6ICNFOUYzRDk7CiRiYXNlLWM6ICM2NjY2NjY7CiRkYXJrLWM6ICNBMUMyMkQ7CiRkYXJrZXItYzogIzg5QUMxMDsKKi8KLyoKJHByaW1hcnktY29sb3VyOiAjMzMzOwokc2Vjb25kYXJ5LWNvbG91cjogbGlnaHRlbigkcHJpbWFyeS1jb2xvdXIsIDIwJSk7CiRiYWNrZ3JvdW5kLWNvbG91cjogI2VmZjsKKi8KLnBhZ2UtbmF2ID4gb2wgPiBsaS5zZWN0aW9uLW5hdjpub3QoOmhvdmVyKSAuc2VjdGlvbi1pdGVtcywgLnBhZ2UtbmF2IGxpOm5vdCg6aG92ZXIpIC5zZWN0aW9uLWl0ZW1zLCAucGFnZS1jb250ZW50IGFydGljbGU6bm90KC5zZWxlY3RlZCksCi5wYWdlLWNvbnRlbnQgc2VjdGlvbjpub3QoLnNlbGVjdGVkKSwgLnRhc2tib3ggaW5wdXQ6bm90KDpjaGVja2VkKSB+IGJsb2NrcXVvdGUsIC5wYWdlLXRpdGxlIHsKICBwb3NpdGlvbjogYWJzb2x1dGUgIWltcG9ydGFudDsKICBsZWZ0OiAtMTAwMDBweDsKICBvdmVyZmxvdzogaGlkZGVuOwogIHdpZHRoOiAxcHg7CiAgaGVpZ2h0OiAxcHg7IH0KICBbZGlyPSJydGwiXSAucGFnZS1uYXYgPiBvbCA+IGxpLnNlY3Rpb24tbmF2Om5vdCg6aG92ZXIpIC5zZWN0aW9uLWl0ZW1zLCAucGFnZS1uYXYgPiBvbCA+IGxpLnNlY3Rpb24tbmF2Om5vdCg6aG92ZXIpIFtkaXI9InJ0bCJdIC5zZWN0aW9uLWl0ZW1zLCBbZGlyPSJydGwiXSAucGFnZS1uYXYgbGk6bm90KDpob3ZlcikgLnNlY3Rpb24taXRlbXMsIC5wYWdlLW5hdiBsaTpub3QoOmhvdmVyKSBbZGlyPSJydGwiXSAuc2VjdGlvbi1pdGVtcywgW2Rpcj0icnRsIl0gLnBhZ2UtY29udGVudCBhcnRpY2xlOm5vdCguc2VsZWN0ZWQpLCAucGFnZS1jb250ZW50IFtkaXI9InJ0bCJdIGFydGljbGU6bm90KC5zZWxlY3RlZCksCiAgW2Rpcj0icnRsIl0gLnBhZ2UtY29udGVudCBzZWN0aW9uOm5vdCguc2VsZWN0ZWQpLCAucGFnZS1jb250ZW50IFtkaXI9InJ0bCJdIHNlY3Rpb246bm90KC5zZWxlY3RlZCksIFtkaXI9InJ0bCJdIC50YXNrYm94IGlucHV0Om5vdCg6Y2hlY2tlZCkgfiBibG9ja3F1b3RlLCAudGFza2JveCBbZGlyPSJydGwiXSBpbnB1dDpub3QoOmNoZWNrZWQpIH4gYmxvY2txdW90ZSwgW2Rpcj0icnRsIl0gLnBhZ2UtdGl0bGUgewogICAgbGVmdDogYXV0bzsKICAgIHJpZ2h0OiAtMTAwMDBweDsgfQoKLnBhZ2UtbmF2IG9sIHsKICBwYWRkaW5nOiAwOwogIG1hcmdpbjogMDsKICBsaXN0LXN0eWxlOiBub25lOyB9CiAgLnBhZ2UtbmF2IG9sIGxpIGEgewogICAgZGlzcGxheTogYmxvY2s7CiAgICBwYWRkaW5nOiAxZW07IH0KICAgIC5wYWdlLW5hdiBvbCBsaSBhLAogICAgLnBhZ2UtbmF2IG9sIGxpIGE6dmlzaXRlZCwKICAgIC5wYWdlLW5hdiBvbCBsaSBhOmFjdGl2ZSB7CiAgICAgIGNvbG9yOiAjNDI0MjQyOwogICAgICB0ZXh0LWRlY29yYXRpb246IG5vbmU7IH0KICAgIC5wYWdlLW5hdiBvbCBsaSBhOmFjdGl2ZSB7CiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTsKICAgICAgdG9wOiAxcHg7IH0KICAucGFnZS1uYXYgb2wgbGkuc2VsZWN0ZWQgPiBhLCAucGFnZS1uYXYgb2wgbGkuc2VsZWN0ZWQgPiBhOnZpc2l0ZWQgewogICAgY29sb3I6ICNmZjk5MDA7IH0KCi5wYWdlLW5hdiA+IG9sIHsKICBkaXNwbGF5OiBmbGV4OwogIGFsaWduLWl0ZW1zOiBzdHJldGNoOyB9CiAgQG1lZGlhIChtYXgtd2lkdGg6IDY0MHB4KSB7CiAgICAucGFnZS1uYXYgPiBvbCB7CiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IH0gfQogIC5wYWdlLW5hdiA+IG9sID4gbGkgewogICAgcG9zaXRpb246IHJlbGF0aXZlOwogICAgZmxleDogMTsgfQogICAgLnBhZ2UtbmF2ID4gb2wgPiBsaSA+IGEgewogICAgICBwYWRkaW5nOiAxZW07IH0KICAgIC5wYWdlLW5hdiA+IG9sID4gbGkuc2VjdGlvbi1uYXY6aG92ZXIgewogICAgICBib3gtc2hhZG93OiAwIDEwcHggMTVweCAjOWE5YTlhOyB9CiAgICAgIC5wYWdlLW5hdiA+IG9sID4gbGkuc2VjdGlvbi1uYXY6aG92ZXIgYSB7CiAgICAgICAgY3Vyc29yOiBwb2ludGVyOyB9CgoucGFnZS1uYXYgLnNlY3Rpb24taXRlbXMgewogIHBvc2l0aW9uOiBhYnNvbHV0ZTsKICB6LWluZGV4OiA5OwogIGxlZnQ6IDA7CiAgdG9wOiAxMDAlOwogIHdpZHRoOiAxMDAlOwogIGJhY2tncm91bmQtY29sb3I6ICNmYWZhZmE7CiAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IDVweDsKICBib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzOiA1cHg7CiAgYm94LXNoYWRvdzogMCAxMHB4IDE1cHggIzlhOWE5YTsgfQogIC5wYWdlLW5hdiAuc2VjdGlvbi1pdGVtcyBsaSB7CiAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgIzlhOWE5YTsgfQogICAgLnBhZ2UtbmF2IC5zZWN0aW9uLWl0ZW1zIGxpOmxhc3QtY2hpbGQgewogICAgICBib3JkZXI6IDA7IH0KCi8qCiRsaWdodGVyLWM6ICNmZmY7CiRsaWdodC1jOiAjRTlGM0Q5OwokYmFzZS1jOiAjNjY2NjY2OwokZGFyay1jOiAjQTFDMjJEOwokZGFya2VyLWM6ICM4OUFDMTA7CiovCi8qCiRwcmltYXJ5LWNvbG91cjogIzMzMzsKJHNlY29uZGFyeS1jb2xvdXI6IGxpZ2h0ZW4oJHByaW1hcnktY29sb3VyLCAyMCUpOwokYmFja2dyb3VuZC1jb2xvdXI6ICNlZmY7CiovCi5wYWdlLW5hdiA+IG9sID4gbGkuc2VjdGlvbi1uYXY6bm90KDpob3ZlcikgLnNlY3Rpb24taXRlbXMsIC5wYWdlLW5hdiBsaTpub3QoOmhvdmVyKSAuc2VjdGlvbi1pdGVtcywgLnBhZ2UtY29udGVudCBhcnRpY2xlOm5vdCguc2VsZWN0ZWQpLAoucGFnZS1jb250ZW50IHNlY3Rpb246bm90KC5zZWxlY3RlZCksIC50YXNrYm94IGlucHV0Om5vdCg6Y2hlY2tlZCkgfiBibG9ja3F1b3RlLCAucGFnZS10aXRsZSB7CiAgcG9zaXRpb246IGFic29sdXRlICFpbXBvcnRhbnQ7CiAgbGVmdDogLTEwMDAwcHg7CiAgb3ZlcmZsb3c6IGhpZGRlbjsKICB3aWR0aDogMXB4OwogIGhlaWdodDogMXB4OyB9CiAgW2Rpcj0icnRsIl0gLnBhZ2UtbmF2ID4gb2wgPiBsaS5zZWN0aW9uLW5hdjpub3QoOmhvdmVyKSAuc2VjdGlvbi1pdGVtcywgLnBhZ2UtbmF2ID4gb2wgPiBsaS5zZWN0aW9uLW5hdjpub3QoOmhvdmVyKSBbZGlyPSJydGwiXSAuc2VjdGlvbi1pdGVtcywgW2Rpcj0icnRsIl0gLnBhZ2UtbmF2IGxpOm5vdCg6aG92ZXIpIC5zZWN0aW9uLWl0ZW1zLCAucGFnZS1uYXYgbGk6bm90KDpob3ZlcikgW2Rpcj0icnRsIl0gLnNlY3Rpb24taXRlbXMsIFtkaXI9InJ0bCJdIC5wYWdlLWNvbnRlbnQgYXJ0aWNsZTpub3QoLnNlbGVjdGVkKSwgLnBhZ2UtY29udGVudCBbZGlyPSJydGwiXSBhcnRpY2xlOm5vdCguc2VsZWN0ZWQpLAogIFtkaXI9InJ0bCJdIC5wYWdlLWNvbnRlbnQgc2VjdGlvbjpub3QoLnNlbGVjdGVkKSwgLnBhZ2UtY29udGVudCBbZGlyPSJydGwiXSBzZWN0aW9uOm5vdCguc2VsZWN0ZWQpLCBbZGlyPSJydGwiXSAudGFza2JveCBpbnB1dDpub3QoOmNoZWNrZWQpIH4gYmxvY2txdW90ZSwgLnRhc2tib3ggW2Rpcj0icnRsIl0gaW5wdXQ6bm90KDpjaGVja2VkKSB+IGJsb2NrcXVvdGUsIFtkaXI9InJ0bCJdIC5wYWdlLXRpdGxlIHsKICAgIGxlZnQ6IGF1dG87CiAgICByaWdodDogLTEwMDAwcHg7IH0KCi5wYWdlLWNvbnRlbnQgewogIGp1c3RpZnktY29udGVudDogY2VudGVyOyB9CiAgLnBhZ2UtY29udGVudCB1bCwgLnBhZ2UtY29udGVudCBvbCB7CiAgICBtYXJnaW4tdG9wOiAwOyB9CiAgICAucGFnZS1jb250ZW50IHVsIGxpLCAucGFnZS1jb250ZW50IG9sIGxpIHsKICAgICAgbWFyZ2luOiAwLjVlbSAwIDAuNWVtIDA7IH0KICAgICAgLnBhZ2UtY29udGVudCB1bCBsaTpmaXJzdC1jaGlsZCwgLnBhZ2UtY29udGVudCBvbCBsaTpmaXJzdC1jaGlsZCB7CiAgICAgICAgbWFyZ2luLXRvcDogMDsgfQogIC5wYWdlLWNvbnRlbnQgb2wgewogICAgY291bnRlci1yZXNldDogaXRlbTsgfQogICAgLnBhZ2UtY29udGVudCBvbC5zZWN0aW9uYWwgewogICAgICBsaXN0LXN0eWxlOiBub25lOyB9CiAgICAgIC5wYWdlLWNvbnRlbnQgb2wuc2VjdGlvbmFsIGxpIHsKICAgICAgICBkaXNwbGF5OiB0YWJsZTsKICAgICAgICB3aWR0aDogMTAwJTsgfQogICAgICAgIC5wYWdlLWNvbnRlbnQgb2wuc2VjdGlvbmFsIGxpOmJlZm9yZSB7CiAgICAgICAgICBkaXNwbGF5OiB0YWJsZS1jZWxsOwogICAgICAgICAgcGFkZGluZy1yaWdodDogMC41ZW07CiAgICAgICAgICB3aWR0aDogMSU7CiAgICAgICAgICBjb250ZW50OiBjb3VudGVycyhpdGVtLCAiLiIpICIuICI7IH0KICAgICAgICAucGFnZS1jb250ZW50IG9sLnNlY3Rpb25hbCBsaTphZnRlciB7CiAgICAgICAgICBjbGVhcjogYm90aDsgfQogICAgLnBhZ2UtY29udGVudCBvbCBsaSB7CiAgICAgIGNvdW50ZXItaW5jcmVtZW50OiBpdGVtOyB9CiAgLnBhZ2UtY29udGVudCBoMiwgLnBhZ2UtY29udGVudCBoMywgLnBhZ2UtY29udGVudCBoNCwgLnBhZ2UtY29udGVudCBoNSwgLnBhZ2UtY29udGVudCBoNiB7CiAgICBmb250LWZhbWlseTogJ1NjaG9vbGJlbGwnLCBzYW5zLXNlcmlmOyB9CiAgLnBhZ2UtY29udGVudCBoMiB7CiAgICBmb250LXNpemU6IDEuNzVlbTsKICAgIGNvbG9yOiAjZmY5OTAwOyB9CiAgLnBhZ2UtY29udGVudCBoMyB7CiAgICBmb250LXNpemU6IDEuNWVtOwogICAgY29sb3I6ICMzMjk5YmI7IH0KICAucGFnZS1jb250ZW50IGg0IHsKICAgIGZvbnQtc2l6ZTogMS4zNWVtOyB9CiAgLnBhZ2UtY29udGVudCBoNSB7CiAgICBmb250LXNpemU6IDEuMmVtOyB9CiAgLnBhZ2UtY29udGVudCBoNiB7CiAgICBmb250LXNpemU6IDEuMWVtOyB9CgpibG9ja3F1b3RlIHsKICBwYWRkaW5nLWxlZnQ6IDFlbTsKICBjb2xvcjogIzlhOWE5YTsKICBib3JkZXItbGVmdDogNHB4IHNvbGlkICM1YzVjNWM7CiAgZm9udC1zaXplOiAwLjg1ZW07CiAgbWFyZ2luLWxlZnQ6IDA7IH0KCmltZyB7CiAgYm9yZGVyLXJhZGl1czogMTBweDsgfQoKLnB1bGwtcmlnaHQgewogIGZsb2F0OiByaWdodDsKICBtYXJnaW46IDA7IH0KICAucHVsbC1yaWdodCBpbWcgewogICAgbWFyZ2luLWxlZnQ6IDFlbTsgfQoKLnB1bGwtbGVmdCB7CiAgZmxvYXQ6IGxlZnQ7CiAgbWFyZ2luOiAwOyB9CiAgLnB1bGwtbGVmdCBpbWcgewogICAgbWFyZ2luLXJpZ2h0OiAxZW07IH0KCnRhYmxlIHsKICBmb250LXNpemU6IDAuOGVtOwogIHRleHQtYWxpZ246IGxlZnQ7IH0KICB0YWJsZSB0aCwgdGFibGUgdGQgewogICAgcGFkZGluZzogMC41ZW07IH0KICB0YWJsZSB0ZCB7CiAgICB2ZXJ0aWNhbC1hbGlnbjogdG9wOyB9CiAgdGFibGUgdHI6aG92ZXIgdGQgewogICAgY29sb3I6ICMzMjk5YmI7IH0KICB0YWJsZSB0aCB7CiAgICBib3JkZXItYm90dG9tOiAycHggc29saWQgIzMyOTliYjsKICAgIGZvbnQtd2VpZ2h0OiBib2xkOwogICAgdmVydGljYWwtYWxpZ246IGJvdHRvbTsgfQogIHRhYmxlIG9sLCB0YWJsZSB1bCB7CiAgICBwYWRkaW5nLWxlZnQ6IDIwcHg7IH0KCi5zYnJlYWsgewogIG1hcmdpbjogMC41ZW07CiAgZGlzcGxheTogYmxvY2s7CiAgY29udGVudDogIiAiOyB9CgouY2hhcnQtd3JpdGluZyB7CiAgZm9udC1mYW1pbHk6ICdQZXJtYW5lbnQgTWFya2VyJywgY3Vyc2l2ZTsgfQoKLmJlbGllZi1zdGF0ZW1lbnQgewogIGZvbnQtZmFtaWx5OiAnQ291cmdldHRlJywgY3Vyc2l2ZTsKICBsaW5lLWhlaWdodDogMTUwJTsKICBmb250LXNpemU6IDEuM2VtOyB9CgouaW5saW5lLWl0ZW1zID4gbGkgewogIGRpc3BsYXk6IGlubGluZS1ibG9jazsKICBib3gtc2l6aW5nOiBib3JkZXItYm94OwogIHdpZHRoOiAzMyU7CiAgbWFyZ2luOiAwLjVlbSAwICFpbXBvcnRhbnQ7IH0KCi50YWJsZS1yZWctc2l6ZSB7CiAgZm9udC1zaXplOiAxZW07IH0KCi50Y2hhcnQgdGQsIC50Y2hhcnQgdGggewogIGJveC1zaXppbmc6IGJvcmRlci1ib3g7CiAgd2lkdGg6IDUwJTsKICBwYWRkaW5nOiAxZW07CiAgdmVydGljYWwtYWxpZ246IG1pZGRsZTsgfQogIC50Y2hhcnQgdGQ6Zmlyc3QtY2hpbGQsIC50Y2hhcnQgdGg6Zmlyc3QtY2hpbGQgewogICAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgIzMyOTliYjsgfQoKLnRjaGFydCB0ZDpmaXJzdC1jaGlsZCwgLnRjaGFydCB0aCB7CiAgdGV4dC1hbGlnbjogY2VudGVyOyB9CgoudGFza2JveCB7CiAgbWFyZ2luLWJvdHRvbTogMWVtOyB9Cgpib2R5IHsKICBmb250LWZhbWlseTogJ1JhbGV3YXknLCBzYW5zLXNlcmlmOwogIGNvbG9yOiAjNDI0MjQyOwogIGJhY2tncm91bmQtY29sb3I6ICNmYWZhZmE7IH0KCi5wYWdlLXdyYXBwZXIgewogIHdpZHRoOiA2NWVtOwogIG1heC13aWR0aDogOTAlOwogIG1hcmdpbjogMCBhdXRvOyB9CgoucGFnZS1uYXYgewogIHBhZGRpbmc6IDFlbSAwOwogIHRleHQtYWxpZ246IGNlbnRlcjsKICBtYXJnaW4tYm90dG9tOiAyZW07IH0KCi8qIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXdvSkluWmxjbk5wYjI0aU9pQXpMQW9KSW1acGJHVWlPaUFpYVc1a1pYZ3VjMk56Y3lJc0Nna2ljMjkxY21ObGN5STZJRnNLQ1FraWFXNWtaWGd1YzJOemN5SXNDZ2tKSW1OdmJHOTFjbk11YzJOemN5SXNDZ2tKSW5WMGFXd3VjMk56Y3lJc0Nna0pJbTVoZGk1elkzTnpJaXdLQ1FraVkyOXVkR1Z1ZEM1elkzTnpJZ29KWFN3S0NTSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNklGc0tDUWtpUUdsdGNHOXlkQ0FuTGk5amIyeHZkWEp6Snp0Y2JrQnBiWEJ2Y25RZ0p5NHZkWFJwYkNjN1hHNWNia0JwYlhCdmNuUWdKeTR2Ym1GMkp6dGNia0JwYlhCdmNuUWdKeTR2WTI5dWRHVnVkQ2M3WEc1Y2JtSnZaSGtnZTF4dVhIUm1iMjUwTFdaaGJXbHNlVG9nSjFKaGJHVjNZWGtuTENCellXNXpMWE5sY21sbU8xeHVYSFJqYjJ4dmNqb2dKR0poYzJVdFl6dGNibHgwWW1GamEyZHliM1Z1WkMxamIyeHZjam9nSkd4cFoyaDBaWEl0WXp0Y2JuMWNibHh1TG5CaFoyVXRkR2wwYkdVZ2UxeHVYSFJBWlhoMFpXNWtJQ1Z2Wm1aelkzSmxaVzQ3WEc1OVhHNWNiaTV3WVdkbExYZHlZWEJ3WlhJZ2UxeHVYSFIzYVdSMGFEb2dOalZsYlR0Y2JseDBiV0Y0TFhkcFpIUm9PaUE1TUNVN1hHNWNkRzFoY21kcGJqb2dNQ0JoZFhSdk8xeHVmVnh1WEc0dWNHRm5aUzF1WVhZZ2UxeHVYSFJ3WVdSa2FXNW5PaUF4WlcwZ01EdGNibHgwZEdWNGRDMWhiR2xuYmpvZ1kyVnVkR1Z5TzF4dVhIUnRZWEpuYVc0dFltOTBkRzl0T2lBeVpXMDdYRzU5WEc0aUxBb0pDU0l2S2x4dUpHeHBaMmgwWlhJdFl6b2dJMlptWmp0Y2JpUnNhV2RvZEMxak9pQWpSVGxHTTBRNU8xeHVKR0poYzJVdFl6b2dJelkyTmpZMk5qdGNiaVJrWVhKckxXTTZJQ05CTVVNeU1rUTdYRzRrWkdGeWEyVnlMV002SUNNNE9VRkRNVEE3WEc0cUwxeHVYRzRrYkdsbmFIUmxjaTFqT2lBalptRm1ZV1poTzF4dUpHeHBaMmgwTFdNNklDTTVZVGxoT1dFN1hHNGtZbUZ6WlMxak9pQWpOREkwTWpReU8xeHVKR1JoY21zdFl6b2dJek15T1RsaVlqdGNiaVJrWVhKclpYSXRZem9nSTJabU9Ua3dNRHRjYmx4dUx5cGNiaVJ3Y21sdFlYSjVMV052Ykc5MWNqb2dJek16TXp0Y2JpUnpaV052Ym1SaGNua3RZMjlzYjNWeU9pQnNhV2RvZEdWdUtDUndjbWx0WVhKNUxXTnZiRzkxY2l3Z01qQWxLVHRjYmlSaVlXTnJaM0p2ZFc1a0xXTnZiRzkxY2pvZ0kyVm1aanRjYmlvdlhHNGlMQW9KQ1NJbGIyWm1jMk55WldWdUlIdGNibHgwSkc5bVpuTmxkRG9nTFRFd01EQXdjSGc3WEc1Y2JseDBjRzl6YVhScGIyNDZJR0ZpYzI5c2RYUmxJQ0ZwYlhCdmNuUmhiblE3WEc1Y2RHeGxablE2SUNSdlptWnpaWFE3WEc1Y2RHOTJaWEptYkc5M09pQm9hV1JrWlc0N1hHNWNkSGRwWkhSb09pQXhjSGc3WEc1Y2RHaGxhV2RvZERvZ01YQjRPMXh1WEc1Y2RGdGthWEk5WENKeWRHeGNJbDBnSmlCN1hHNWNkRngwYkdWbWREb2dZWFYwYnp0Y2JseDBYSFJ5YVdkb2REb2dKRzltWm5ObGREdGNibHgwZlZ4dWZWeHVJaXdLQ1FraVFHbHRjRzl5ZENBbkxpOWpiMnh2ZFhKekp6dGNia0JwYlhCdmNuUWdKeTR2ZFhScGJDYzdYRzVjYmk1d1lXZGxMVzVoZGlCN1hHNWNkQ1JsYm5SeWVTMXdZV1JrYVc1bk9pQXhaVzA3WEc1Y2JseDBiMndnZTF4dVhIUmNkSEJoWkdScGJtYzZJREE3WEc1Y2RGeDBiV0Z5WjJsdU9pQXdPMXh1WEhSY2RHeHBjM1F0YzNSNWJHVTZJRzV2Ym1VN1hHNWNibHgwWEhSc2FTQjdYRzVjZEZ4MFhIUmhJSHRjYmx4MFhIUmNkRngwWkdsemNHeGhlVG9nWW14dlkyczdYRzVjZEZ4MFhIUmNkSEJoWkdScGJtYzZJQ1JsYm5SeWVTMXdZV1JrYVc1bk8xeHVYRzVjZEZ4MFhIUmNkQ1lzWEc1Y2RGeDBYSFJjZENZNmRtbHphWFJsWkN4Y2JseDBYSFJjZEZ4MEpqcGhZM1JwZG1VZ2UxeHVYSFJjZEZ4MFhIUmNkR052Ykc5eU9pQWtZbUZ6WlMxak8xeHVYSFJjZEZ4MFhIUmNkSFJsZUhRdFpHVmpiM0poZEdsdmJqb2dibTl1WlR0Y2JseDBYSFJjZEZ4MGZWeHVYRzVjZEZ4MFhIUmNkQ1k2WVdOMGFYWmxJSHRjYmx4MFhIUmNkRngwWEhSd2IzTnBkR2x2YmpvZ2NtVnNZWFJwZG1VN1hHNWNkRngwWEhSY2RGeDBkRzl3T2lBeGNIZzdYRzVjZEZ4MFhIUmNkSDFjYmx4MFhIUmNkSDFjYmx4dVhIUmNkRngwSmk1elpXeGxZM1JsWkNCN1hHNWNkRngwWEhSY2RENGdZU0I3WEc1Y2RGeDBYSFJjZEZ4MEppd2dKanAyYVhOcGRHVmtJSHRjYmx4MFhIUmNkRngwWEhSY2RHTnZiRzl5T2lBa1pHRnlhMlZ5TFdNN1hHNWNkRngwWEhSY2RGeDBmVnh1WEhSY2RGeDBYSFI5WEc1Y2RGeDBYSFI5WEc1Y2RGeDBmVnh1WEhSOVhHNWNibHgwUGlCdmJDQjdYRzVjZEZ4MFpHbHpjR3hoZVRvZ1pteGxlRHRjYmx4MFhIUmhiR2xuYmkxcGRHVnRjem9nYzNSeVpYUmphRHRjYmx4dVhIUmNkRUJ0WldScFlTQW9iV0Y0TFhkcFpIUm9PaUEyTkRCd2VDa2dlMXh1WEhSY2RGeDBabXhsZUMxa2FYSmxZM1JwYjI0NklHTnZiSFZ0Ymp0Y2JseDBYSFI5WEc1Y2JseDBYSFErSUd4cElIdGNibHgwWEhSY2RIQnZjMmwwYVc5dU9pQnlaV3hoZEdsMlpUdGNibHgwWEhSY2RHWnNaWGc2SURFN1hHNWNibHgwWEhSY2RENGdZU0I3WEc1Y2RGeDBYSFJjZEhCaFpHUnBibWM2SUNSbGJuUnllUzF3WVdSa2FXNW5PMXh1WEhSY2RGeDBmVnh1WEc1Y2RGeDBYSFFtTG5ObFkzUnBiMjR0Ym1GMklIdGNibHgwWEhSY2RGeDBKanB1YjNRb09taHZkbVZ5S1NBdWMyVmpkR2x2YmkxcGRHVnRjeUI3WEc1Y2RGeDBYSFJjZEZ4MFFHVjRkR1Z1WkNBbGIyWm1jMk55WldWdU8xeHVYSFJjZEZ4MFhIUjlYRzVjYmx4MFhIUmNkRngwSmpwb2IzWmxjaUI3WEc1Y2RGeDBYSFJjZEZ4MFltOTRMWE5vWVdSdmR6b2dNQ0F4TUhCNElERTFjSGdnSkd4cFoyaDBMV003WEc1Y2JseDBYSFJjZEZ4MFhIUmhJSHRjYmx4MFhIUmNkRngwWEhSY2RHTjFjbk52Y2pvZ2NHOXBiblJsY2p0Y2JseDBYSFJjZEZ4MFhIUjlYRzVjZEZ4MFhIUmNkSDFjYmx4MFhIUmNkSDFjYmx4MFhIUjlYRzVjZEgxY2JseHVYSFJzYVRwdWIzUW9PbWh2ZG1WeUtTQXVjMlZqZEdsdmJpMXBkR1Z0Y3lCN1hHNWNkRngwUUdWNGRHVnVaQ0FsYjJabWMyTnlaV1Z1TzF4dVhIUjlYRzVjYmx4MExuTmxZM1JwYjI0dGFYUmxiWE1nZTF4dVhIUmNkSEJ2YzJsMGFXOXVPaUJoWW5OdmJIVjBaVHRjYmx4MFhIUjZMV2x1WkdWNE9pQTVPMXh1WEc1Y2RGeDBiR1ZtZERvZ01EdGNibHgwWEhSMGIzQTZJREV3TUNVN1hHNWNibHgwWEhSM2FXUjBhRG9nTVRBd0pUdGNibHh1WEhSY2RHSmhZMnRuY205MWJtUXRZMjlzYjNJNklDUnNhV2RvZEdWeUxXTTdYRzVjZEZ4MFltOXlaR1Z5TFdKdmRIUnZiUzF5YVdkb2RDMXlZV1JwZFhNNklEVndlRHRjYmx4MFhIUmliM0prWlhJdFltOTBkRzl0TFd4bFpuUXRjbUZrYVhWek9pQTFjSGc3WEc1Y2RGeDBZbTk0TFhOb1lXUnZkem9nTUNBeE1IQjRJREUxY0hnZ0pHeHBaMmgwTFdNN1hHNWNibHh1WEhSY2RHeHBJSHRjYmx4MFhIUmNkR0p2Y21SbGNpMWliM1IwYjIwNklERndlQ0J6YjJ4cFpDQWtiR2xuYUhRdFl6dGNibHh1WEhSY2RGeDBKanBzWVhOMExXTm9hV3hrSUh0Y2JseDBYSFJjZEZ4MFltOXlaR1Z5T2lBd08xeHVYSFJjZEZ4MGZWeHVYSFJjZEgxY2JseDBmVnh1ZlZ4dUlpd0tDUWtpUUdsdGNHOXlkQ0FuTGk5amIyeHZkWEp6Snp0Y2JrQnBiWEJ2Y25RZ0p5NHZkWFJwYkNjN1hHNWNiaTV3WVdkbExXTnZiblJsYm5RZ2UxeHVYSFJxZFhOMGFXWjVMV052Ym5SbGJuUTZJR05sYm5SbGNqdGNibHh1WEhSaGNuUnBZMnhsT201dmRDZ3VjMlZzWldOMFpXUXBMRnh1WEhSelpXTjBhVzl1T201dmRDZ3VjMlZzWldOMFpXUXBJSHRjYmx4MFhIUkFaWGgwWlc1a0lDVnZabVp6WTNKbFpXNDdYRzVjZEgxY2JseDBkV3dzSUc5c0lIdGNibHgwWEhSdFlYSm5hVzR0ZEc5d09pQXdPMXh1WEc1Y2RGeDBiR2tnZTF4dVhIUmNkRngwYldGeVoybHVPaUF3TGpWbGJTQXdJREF1TldWdElEQTdYRzVjYmx4MFhIUmNkQ1k2Wm1seWMzUXRZMmhwYkdRZ2UxeHVYSFJjZEZ4MFhIUnRZWEpuYVc0dGRHOXdPaUF3TzF4dVhIUmNkRngwZlZ4dVhIUmNkSDFjYmx4MGZWeHVYRzVjZEM4dklFZHBkbVZ6SURFdU1Td2dNUzR5TENBeUxqRWdNaTR5SUhObFkzUnBiMjRnYm5WdFltVnljMXh1WEhSdmJDQjdYRzVjZEZ4MFkyOTFiblJsY2kxeVpYTmxkRG9nYVhSbGJUdGNibHh1WEhSY2RDWXVjMlZqZEdsdmJtRnNJSHRjYmx4MFhIUmNkR3hwYzNRdGMzUjViR1U2SUc1dmJtVTdYRzVjYmx4MFhIUmNkR3hwSUh0Y2JseDBYSFJjZEZ4MFpHbHpjR3hoZVRvZ2RHRmliR1U3WEc1Y2RGeDBYSFJjZEhkcFpIUm9PaUF4TURBbE8xeHVYRzVjZEZ4MFhIUmNkQ1k2WW1WbWIzSmxJSHRjYmx4MFhIUmNkRngwWEhSa2FYTndiR0Y1T2lCMFlXSnNaUzFqWld4c08xeHVYSFJjZEZ4MFhIUmNkSEJoWkdScGJtY3RjbWxuYUhRNklEQXVOV1Z0TzF4dVhIUmNkRngwWEhSY2RIZHBaSFJvT2lBeEpUdGNibHh1WEhSY2RGeDBYSFJjZEdOdmJuUmxiblE2SUdOdmRXNTBaWEp6S0dsMFpXMHNJRndpTGx3aUtTQmNJaTRnWENJN1hHNWNkRngwWEhSY2RIMWNibHh1WEhSY2RGeDBYSFFtT21GbWRHVnlJSHRjYmx4MFhIUmNkRngwWEhSamJHVmhjam9nWW05MGFEdGNibHgwWEhSY2RGeDBmVnh1WEhSY2RGeDBmVnh1WEhSY2RIMWNibHh1WEhSY2RHeHBJSHRjYmx4MFhIUmNkR052ZFc1MFpYSXRhVzVqY21WdFpXNTBPaUJwZEdWdE8xeHVYSFJjZEgxY2JseHVYRzVjZEgxY2JseDBMeThnUlc1a0lITmxZM1JwYjI0Z2JuVnRZbVZ5YzF4dVhIUmNibHgwYURJc0lHZ3pMQ0JvTkN3Z2FEVXNJR2cySUhzZ1ptOXVkQzFtWVcxcGJIazZJQ2RUWTJodmIyeGlaV3hzSnl3Z2MyRnVjeTF6WlhKcFpqc2dmVnh1WEhSb01pQjdJR1p2Ym5RdGMybDZaVG9nTVM0M05XVnRPeUJqYjJ4dmNqb2dKR1JoY210bGNpMWpPeUI5WEc1Y2RHZ3pJSHNnWm05dWRDMXphWHBsT2lBeExqVmxiVHNnWTI5c2IzSTZJQ1JrWVhKckxXTTdJSDFjYmx4MGFEUWdleUJtYjI1MExYTnBlbVU2SURFdU16VmxiVHNnZlZ4dVhIUm9OU0I3SUdadmJuUXRjMmw2WlRvZ01TNHlaVzA3SUgxY2JseDBhRFlnZXlCbWIyNTBMWE5wZW1VNklERXVNV1Z0T3lCOVhHNTlYRzVjYm1Kc2IyTnJjWFZ2ZEdVZ2UxeHVYSFJ3WVdSa2FXNW5MV3hsWm5RNklERmxiVHRjYmx4MFkyOXNiM0k2SUNSc2FXZG9kQzFqTzF4dVhIUmliM0prWlhJdGJHVm1kRG9nTkhCNElITnZiR2xrSUd4cFoyaDBaVzRvSkdKaGMyVXRZeXdnTVRBbEtUdGNibHgwWm05dWRDMXphWHBsT2lBd0xqZzFaVzA3WEc1Y2RHMWhjbWRwYmkxc1pXWjBPaUF3TzF4dWZWeHVYRzVwYldjZ2UxeHVYSFJpYjNKa1pYSXRjbUZrYVhWek9pQXhNSEI0TzF4dWZWeHVYRzR1Y0hWc2JDMXlhV2RvZENCN1hHNWNkR1pzYjJGME9pQnlhV2RvZER0Y2JseDBiV0Z5WjJsdU9pQXdPMXh1WEc1Y2RHbHRaeUI3WEc1Y2RGeDBiV0Z5WjJsdUxXeGxablE2SURGbGJUdGNibHgwZlZ4dWZWeHVYRzR1Y0hWc2JDMXNaV1owSUh0Y2JseDBabXh2WVhRNklHeGxablE3WEc1Y2RHMWhjbWRwYmpvZ01EdGNibHh1WEhScGJXY2dlMXh1WEhSY2RHMWhjbWRwYmkxeWFXZG9kRG9nTVdWdE8xeHVYSFI5WEc1OVhHNWNiblJoWW14bElIdGNibHgwWm05dWRDMXphWHBsT2lBd0xqaGxiVHRjYmx4MGRHVjRkQzFoYkdsbmJqb2diR1ZtZER0Y2JseHVYSFIwYUN3Z2RHUWdlMXh1WEhSY2RIQmhaR1JwYm1jNklEQXVOV1Z0TzF4dVhIUjlYRzVjZEZ4dVhIUjBaQ0I3WEc1Y2RGeDBkbVZ5ZEdsallXd3RZV3hwWjI0NklIUnZjRHRjYmx4MGZWeHVYRzVjZEhSeU9taHZkbVZ5SUhSa0lIdGNibHgwWEhSamIyeHZjam9nSkdSaGNtc3RZenRjYmx4MGZWeHVYRzVjZEhSb0lIdGNibHgwWEhSaWIzSmtaWEl0WW05MGRHOXRPaUF5Y0hnZ2MyOXNhV1FnSkdSaGNtc3RZenRjYmx4MFhIUm1iMjUwTFhkbGFXZG9kRG9nWW05c1pEdGNibHgwWEhSMlpYSjBhV05oYkMxaGJHbG5iam9nWW05MGRHOXRYRzVjZEgxY2JseDBYRzVjZEc5c0xDQjFiQ0I3WEc1Y2RGeDBjR0ZrWkdsdVp5MXNaV1owT2lBeU1IQjRPMXh1WEhSOVhHNTlYRzVjYmk1elluSmxZV3NnZTF4dVhIUnRZWEpuYVc0NklEQXVOV1Z0TzF4dVhIUmthWE53YkdGNU9pQmliRzlqYXp0Y2JseDBZMjl1ZEdWdWREb2dYQ0lnWENJN1hHNTlYRzVjYmk1amFHRnlkQzEzY21sMGFXNW5JSHRjYmx4MFptOXVkQzFtWVcxcGJIazZJQ2RRWlhKdFlXNWxiblFnVFdGeWEyVnlKeXdnWTNWeWMybDJaVHRjYm4xY2JseHVMbUpsYkdsbFppMXpkR0YwWlcxbGJuUWdlMXh1WEhSbWIyNTBMV1poYldsc2VUb2dKME52ZFhKblpYUjBaU2NzSUdOMWNuTnBkbVU3WEc1Y2RHeHBibVV0YUdWcFoyaDBPaUF4TlRBbE8xeHVYSFJtYjI1MExYTnBlbVU2SURFdU0yVnRPMXh1ZlZ4dVhHNHVhVzVzYVc1bExXbDBaVzF6SUQ0Z2JHa2dlMXh1SUNCY2RHUnBjM0JzWVhrNklHbHViR2x1WlMxaWJHOWphenRjYmlBZ1hIUmliM2d0YzJsNmFXNW5PaUJpYjNKa1pYSXRZbTk0TzF4dUlDQmNkSGRwWkhSb09pQXpNeVU3WEc1Y2RHMWhjbWRwYmpvZ01DNDFaVzBnTUNBaGFXMXdiM0owWVc1ME8xeHVmVnh1WEc0dWRHRmliR1V0Y21WbkxYTnBlbVVnZTF4dVhIUm1iMjUwTFhOcGVtVTZJREZsYlR0Y2JuMWNibHh1TG5SamFHRnlkQ0I3WEc1Y2RIUmtMQ0IwYUNCN1hHNWNkRngwWW05NExYTnBlbWx1WnpvZ1ltOXlaR1Z5TFdKdmVEdGNibHgwWEhSM2FXUjBhRG9nTlRBbE8xeHVYSFJjZEhCaFpHUnBibWM2SURGbGJUdGNibHgwWEhSMlpYSjBhV05oYkMxaGJHbG5iam9nYldsa1pHeGxPMXh1WEc1Y2RGeDBKanBtYVhKemRDMWphR2xzWkNCN1hHNWNkRngwWEhSaWIzSmtaWEl0Y21sbmFIUTZJREZ3ZUNCemIyeHBaQ0FrWkdGeWF5MWpPMXh1WEhSY2RIMWNibHgwZlZ4dVhHNWNkSFJrT21acGNuTjBMV05vYVd4a0xDQjBhQ0I3WEc1Y2RGeDBkR1Y0ZEMxaGJHbG5iam9nWTJWdWRHVnlPMXh1WEhSOVhHNTlYRzVjYmk1MFlYTnJZbTk0SUh0Y2JseDBiV0Z5WjJsdUxXSnZkSFJ2YlRvZ01XVnRPMXh1WEc1Y2RHbHVjSFYwT201dmRDZzZZMmhsWTJ0bFpDa2dmaUJpYkc5amEzRjFiM1JsSUh0Y2JseDBYSFJBWlhoMFpXNWtJQ1Z2Wm1aelkzSmxaVzQ3WEc1Y2RIMWNibjFjYmlJS0NWMHNDZ2tpYldGd2NHbHVaM01pT2lBaVFVTkJRVHM3T3pzN08wVkJUVVU3UVVGUlJqczdPenRGUVVsRk8wRkRiRUpWTEZOQlFWTXNSMEZCUnl4RlFVRkZMRWRCUVVjc1JVRkJSU3hCUVVGQkxGbEJRVmtzUVVGQlFTeExRVUZMTEVGQlFVRXNUVUZCVFN4RlFVRkZMR05CUVdNc1JVRkJSU3hUUVVGVExFTkJRVU1zUlVGQlJTeEJRVUZCTEV0QlFVc3NRVUZCUVN4TlFVRk5MRVZCUVVVc1kwRkJZeXhGUVVGRkxHRkJRV0VzUTBGQlF5eFBRVUZQTEVGQlFVRXNTMEZCU3l4QlFVRkJMRk5CUVZNN1FVRkRjRW9zWVVGQllTeERRVUZETEU5QlFVOHNRVUZCUVN4TFFVRkxMRUZCUVVFc1UwRkJVeXhIUVVGSExGRkJRVkVzUTBGQlF5eExRVUZMTEVGQlFVRXNTMEZCU3l4QlFVRkJMRkZCUVZFc1NVRkJTU3hWUVVGVkxFVkJRVVVzVjBGQlZ5eERRVVJxUmp0RlFVZFdMRkZCUVZFc1JVRkJSU3h0UWtGQmIwSTdSVUZET1VJc1NVRkJTU3hGUVVoTkxGRkJRVTg3UlVGSmFrSXNVVUZCVVN4RlFVRkZMRTFCUVU4N1JVRkRha0lzUzBGQlN5eEZRVUZGTEVkQlFVazdSVUZEV0N4TlFVRk5MRVZCUVVVc1IwRkJTU3hIUVZCRU8wZEJVM2xDTEVGQlFVRXNSMEZCUXl4RFFVRkpMRXRCUVVzc1FVRkJWQ3hGUVVGWExGTkJRVk1zUjBGQlJ5eEZRVUZGTEVkQlFVY3NSVUZCUlN4QlFVRkJMRmxCUVZrc1FVRkJRU3hMUVVGTExFRkJRVUVzVFVGQlRTeEZRVUZGTEdOQlFXTXNSVUZCUlN4VFFVRlRMRWRCUVVjc1JVRkJSU3hIUVVGSExFVkJRVVVzUVVGQlFTeFpRVUZaTEVGQlFVRXNTMEZCU3l4QlFVRkJMRTFCUVUwc1IwRkJSU3hCUVVGQkxFZEJRVU1zUTBGQlNTeExRVUZMTEVGQlFWUXNSVUZCVnl4alFVRmpMRWRCUVVVc1FVRkJRU3hIUVVGRExFTkJRVWtzUzBGQlN5eEJRVUZVTEVWQlFWY3NVMEZCVXl4RFFVRkRMRVZCUVVVc1FVRkJRU3hMUVVGTExFRkJRVUVzVFVGQlRTeEZRVUZGTEdOQlFXTXNSVUZCUlN4VFFVRlRMRU5CUVVNc1JVRkJSU3hCUVVGQkxFdEJRVXNzUVVGQlFTeE5RVUZOTEVkQlFVVXNRVUZCUVN4SFFVRkRMRU5CUVVrc1MwRkJTeXhCUVVGVUxFVkJRVmNzWTBGQll5eEhRVUZGTEVGQlFVRXNSMEZCUXl4RFFVRkpMRXRCUVVzc1FVRkJWQ3hGUVVGWExHRkJRV0VzUTBGQlF5eFBRVUZQTEVGQlFVRXNTMEZCU3l4QlFVRkJMRk5CUVZNc1IwRkJSeXhoUVVGaExFVkJRVU1zUVVGQlFTeEhRVUZETEVOQlFVa3NTMEZCU3l4QlFVRlVMRVZCUVZjc1QwRkJUeXhCUVVGQkxFdEJRVXNzUVVGQlFTeFRRVUZUTzBkQlEyaFpMRUZCUVVFc1IwRkJReXhEUVVGSkxFdEJRVXNzUVVGQlZDeEZRVUZYTEdGQlFXRXNRMEZCUXl4UFFVRlBMRUZCUVVFc1MwRkJTeXhCUVVGQkxGTkJRVk1zUjBGQlJ5eGhRVUZoTEVWQlFVTXNRVUZCUVN4SFFVRkRMRU5CUVVrc1MwRkJTeXhCUVVGVUxFVkJRVmNzVDBGQlR5eEJRVUZCTEV0QlFVc3NRVUZCUVN4VFFVRlRMRWxCUVVjc1FVRkJRU3hIUVVGRExFTkJRVWtzUzBGQlN5eEJRVUZVTEVWQlFWY3NVVUZCVVN4RFFVRkRMRXRCUVVzc1FVRkJRU3hMUVVGTExFRkJRVUVzVVVGQlVTeEpRVUZKTEZWQlFWVXNSVUZCUlN4UlFVRlJMRVZCUVVNc1FVRkJRU3hIUVVGRExFTkJRVWtzUzBGQlN5eEJRVUZVTEVWQlFWY3NTMEZCU3l4QlFVRkJMRXRCUVVzc1FVRkJRU3hSUVVGUkxFbEJRVWtzVlVGQlZTeEhRVUZGTEVGQlFVRXNSMEZCUXl4RFFVRkpMRXRCUVVzc1FVRkJWQ3hGUVVGWExGZEJRVmNzUTBGRU1VNDdTVUZEWWl4SlFVRkpMRVZCUVVVc1NVRkJTenRKUVVOWUxFdEJRVXNzUlVGV1NTeFJRVUZQTEVkQlVVWTdPMEZFVkdoQ096czdPenM3UlVGTlJUdEJRVkZHT3pzN08wVkJTVVU3UVVOc1FsVXNVMEZCVXl4SFFVRkhMRVZCUVVVc1IwRkJSeXhGUVVGRkxFRkJRVUVzV1VGQldTeEJRVUZCTEV0QlFVc3NRVUZCUVN4TlFVRk5MRVZCUVVVc1kwRkJZeXhGUVVGRkxGTkJRVk1zUTBGQlF5eEZRVUZGTEVGQlFVRXNTMEZCU3l4QlFVRkJMRTFCUVUwc1JVRkJSU3hqUVVGakxFVkJRVVVzWVVGQllTeERRVUZETEU5QlFVOHNRVUZCUVN4TFFVRkxMRUZCUVVFc1UwRkJVenRCUVVOd1NpeGhRVUZoTEVOQlFVTXNUMEZCVHl4QlFVRkJMRXRCUVVzc1FVRkJRU3hUUVVGVExFZEJRVWNzVVVGQlVTeERRVUZETEV0QlFVc3NRVUZCUVN4TFFVRkxMRUZCUVVFc1VVRkJVU3hKUVVGSkxGVkJRVlVzUlVGQlJTeFhRVUZYTEVOQlJHcEdPMFZCUjFZc1VVRkJVU3hGUVVGRkxHMUNRVUZ2UWp0RlFVTTVRaXhKUVVGSkxFVkJTRTBzVVVGQlR6dEZRVWxxUWl4UlFVRlJMRVZCUVVVc1RVRkJUenRGUVVOcVFpeExRVUZMTEVWQlFVVXNSMEZCU1R0RlFVTllMRTFCUVUwc1JVRkJSU3hIUVVGSkxFZEJVRVE3UjBGVGVVSXNRVUZCUVN4SFFVRkRMRU5CUVVrc1MwRkJTeXhCUVVGVUxFVkJRVmNzVTBGQlV5eEhRVUZITEVWQlFVVXNSMEZCUnl4RlFVRkZMRUZCUVVFc1dVRkJXU3hCUVVGQkxFdEJRVXNzUVVGQlFTeE5RVUZOTEVWQlFVVXNZMEZCWXl4RlFVRkZMRk5CUVZNc1IwRkJSeXhGUVVGRkxFZEJRVWNzUlVGQlJTeEJRVUZCTEZsQlFWa3NRVUZCUVN4TFFVRkxMRUZCUVVFc1RVRkJUU3hIUVVGRkxFRkJRVUVzUjBGQlF5eERRVUZKTEV0QlFVc3NRVUZCVkN4RlFVRlhMR05CUVdNc1IwRkJSU3hCUVVGQkxFZEJRVU1zUTBGQlNTeExRVUZMTEVGQlFWUXNSVUZCVnl4VFFVRlRMRU5CUVVNc1JVRkJSU3hCUVVGQkxFdEJRVXNzUVVGQlFTeE5RVUZOTEVWQlFVVXNZMEZCWXl4RlFVRkZMRk5CUVZNc1EwRkJReXhGUVVGRkxFRkJRVUVzUzBGQlN5eEJRVUZCTEUxQlFVMHNSMEZCUlN4QlFVRkJMRWRCUVVNc1EwRkJTU3hMUVVGTExFRkJRVlFzUlVGQlZ5eGpRVUZqTEVkQlFVVXNRVUZCUVN4SFFVRkRMRU5CUVVrc1MwRkJTeXhCUVVGVUxFVkJRVmNzWVVGQllTeERRVUZETEU5QlFVOHNRVUZCUVN4TFFVRkxMRUZCUVVFc1UwRkJVeXhIUVVGSExHRkJRV0VzUlVGQlF5eEJRVUZCTEVkQlFVTXNRMEZCU1N4TFFVRkxMRUZCUVZRc1JVRkJWeXhQUVVGUExFRkJRVUVzUzBGQlN5eEJRVUZCTEZOQlFWTTdSMEZEYUZrc1FVRkJRU3hIUVVGRExFTkJRVWtzUzBGQlN5eEJRVUZVTEVWQlFWY3NZVUZCWVN4RFFVRkRMRTlCUVU4c1FVRkJRU3hMUVVGTExFRkJRVUVzVTBGQlV5eEhRVUZITEdGQlFXRXNSVUZCUXl4QlFVRkJMRWRCUVVNc1EwRkJTU3hMUVVGTExFRkJRVlFzUlVGQlZ5eFBRVUZQTEVGQlFVRXNTMEZCU3l4QlFVRkJMRk5CUVZNc1NVRkJSeXhCUVVGQkxFZEJRVU1zUTBGQlNTeExRVUZMTEVGQlFWUXNSVUZCVnl4UlFVRlJMRU5CUVVNc1MwRkJTeXhCUVVGQkxFdEJRVXNzUVVGQlFTeFJRVUZSTEVsQlFVa3NWVUZCVlN4RlFVRkZMRkZCUVZFc1JVRkJReXhCUVVGQkxFZEJRVU1zUTBGQlNTeExRVUZMTEVGQlFWUXNSVUZCVnl4TFFVRkxMRUZCUVVFc1MwRkJTeXhCUVVGQkxGRkJRVkVzU1VGQlNTeFZRVUZWTEVkQlFVVXNRVUZCUVN4SFFVRkRMRU5CUVVrc1MwRkJTeXhCUVVGVUxFVkJRVmNzVjBGQlZ5eERRVVF4VGp0SlFVTmlMRWxCUVVrc1JVRkJSU3hKUVVGTE8wbEJRMWdzUzBGQlN5eEZRVlpKTEZGQlFVOHNSMEZSUmpzN1FVTklaaXhUUVVGVExFTkJRVU1zUlVGQlJTeERRVUZVTzBWQlEwWXNUMEZCVHl4RlFVRkZMRU5CUVVVN1JVRkRXQ3hOUVVGTkxFVkJRVVVzUTBGQlJUdEZRVU5XTEZWQlFWVXNSVUZCUlN4SlFVRkxMRWRCU0dRN1JVRk5SaXhUUVVGVExFTkJRVU1zUlVGQlJTeERRVUZETEVWQlFVVXNRMEZCUXl4RFFVRkRMRU5CUVdZN1NVRkRSQ3hQUVVGUExFVkJRVVVzUzBGQlRUdEpRVU5tTEU5QlFVOHNSVUZXVFN4SFFVRkhMRWRCVVdRN1NVRk5SQ3hUUVVGVExFTkJRVU1zUlVGQlJTeERRVUZETEVWQlFVVXNRMEZCUXl4RFFVRkRPMGxCUTNSQ0xGTkJRVk1zUTBGQlF5eEZRVUZGTEVOQlFVTXNSVUZCUlN4RFFVRkRMRU5CUVVNc1FVRkJRU3hSUVVGUk8wbEJRM3BDTEZOQlFWTXNRMEZCUXl4RlFVRkZMRU5CUVVNc1JVRkJSU3hEUVVGRExFTkJRVU1zUVVGQlFTeFBRVUZQTEVOQlJsZzdUVUZEVWl4TFFVRkxMRVZHVkVRc1QwRkJUenROUlZWWUxHVkJRV1VzUlVGQlJTeEpRVUZMTEVkQlJtSTdTVUZMVkN4VFFVRlRMRU5CUVVNc1JVRkJSU3hEUVVGRExFVkJRVVVzUTBGQlF5eERRVUZETEVGQlFVRXNUMEZCVHl4RFFVRm9RanROUVVOU0xGRkJRVkVzUlVGQlJTeFJRVUZUTzAxQlEyNUNMRWRCUVVjc1JVRkJSU3hIUVVGSkxFZEJSa0U3UlVGUlRDeFRRVUZUTEVOQlFVTXNSVUZCUlN4RFFVRkRMRVZCUVVVc1FVRkJRU3hUUVVGVExFZEJRVWNzUTBGQlF5eEZRVUZGTEZOQlFWTXNRMEZCUXl4RlFVRkZMRU5CUVVNc1JVRkJSU3hCUVVGQkxGTkJRVk1zUjBGQlJ5eERRVUZETEVGQlFVRXNVVUZCVVN4RFFVRjZSRHRKUVVOYUxFdEJRVXNzUlVad1FrRXNUMEZCVHl4SFJXMUNRenM3UVVGUmFFSXNVMEZCVXl4SFFVRkhMRVZCUVVVc1EwRkJXRHRGUVVOS0xFOUJRVThzUlVGQlJTeEpRVUZMTzBWQlEyUXNWMEZCVnl4RlFVRkZMRTlCUVZFc1IwRkdhRUk3UlVGSlRDeE5RVUZOTEVWQlFVd3NVMEZCVXl4RlFVRkZMRXRCUVVzN1NVRkthRUlzVTBGQlV5eEhRVUZITEVWQlFVVXNRMEZCV0R0TlFVdElMR05CUVdNc1JVRkJSU3hOUVVGUExFZEJURzVDTzBWQlVVZ3NVMEZCVXl4SFFVRkhMRVZCUVVVc1IwRkJSeXhGUVVGRkxFTkJRV2hDTzBsQlEwb3NVVUZCVVN4RlFVRkZMRkZCUVZNN1NVRkRia0lzU1VGQlNTeEZRVUZGTEVOQlFVVXNSMEZHU0R0SlFVbElMRk5CUVZNc1IwRkJSeXhGUVVGRkxFZEJRVWNzUlVGQlJTeEhRVUZITEVOQlFVTXNRMEZCY2tJN1RVRkRTQ3hQUVVGUExFVkJhRVJOTEVkQlFVY3NSMEVyUTFvN1NVRlRTQ3hUUVVGVExFZEJRVWNzUlVGQlJTeEhRVUZITEVWQlFVVXNRVUZCUVN4WlFVRlpMRUZCUVVFc1RVRkJUU3hEUVVFNVFqdE5RVU5RTEZWQlFWVXNSVUZCUlN4RFFVRkRMRU5CUVVNc1NVRkJTU3hEUVVGRExFbEJRVWtzUTBad1JHeENMRTlCUVU4c1IwVnRSRW83VFVGSFVpeFRRVUZUTEVkQlFVY3NSVUZCUlN4SFFVRkhMRVZCUVVVc1FVRkJRU3haUVVGWkxFRkJRVUVzVFVGQlRTeERRVUZETEVOQlFVTXNRMEZCY2tNN1VVRkRSQ3hOUVVGTkxFVkJRVVVzVDBGQlVTeEhRVVJrT3p0QlFWbFFMRk5CUVZNc1EwRkJReXhqUVVGakxFTkJRVlE3UlVGRFpDeFJRVUZSTEVWQlFVVXNVVUZCVXp0RlFVTnVRaXhQUVVGUExFVkJRVVVzUTBGQlJUdEZRVVZZTEVsQlFVa3NSVUZCUlN4RFFVRkZPMFZCUTFJc1IwRkJSeXhGUVVGRkxFbEJRVXM3UlVGRlZpeExRVUZMTEVWQlFVVXNTVUZCU3p0RlFVVmFMR2RDUVVGblFpeEZSalZGVGl4UFFVRlBPMFZGTmtWcVFpd3dRa0ZCTUVJc1JVRkJSU3hIUVVGSk8wVkJRMmhETEhsQ1FVRjVRaXhGUVVGRkxFZEJRVWs3UlVGREwwSXNWVUZCVlN4RlFVRkZMRU5CUVVNc1EwRkJReXhKUVVGSkxFTkJRVU1zU1VGQlNTeERSamxGWml4UFFVRlBMRWRGYTBWQk8wVkJaV1lzVTBGQlV5eERRVUZETEdOQlFXTXNRMEZCUXl4RlFVRkZMRU5CUVhoQ08wbEJRMFlzWVVGQllTeEZRVUZGTEVkQlFVY3NRMEZCUXl4TFFVRkxMRU5HYkVacVFpeFBRVUZQTEVkRmFVWllPMGxCUjBZc1UwRkJVeXhEUVVGRExHTkJRV01zUTBGQlF5eEZRVUZGTEVGQlFVRXNWMEZCVnl4RFFVRXhRanROUVVOYUxFMUJRVTBzUlVGQlJTeERRVUZGTEVkQlJFYzdPMEZHTjBacVFqczdPenM3TzBWQlRVVTdRVUZSUmpzN096dEZRVWxGTzBGRGJFSlZMRk5CUVZNc1IwRkJSeXhGUVVGRkxFZEJRVWNzUlVGQlJTeEJRVUZCTEZsQlFWa3NRVUZCUVN4TFFVRkxMRUZCUVVFc1RVRkJUU3hGUVVGRkxHTkJRV01zUlVGQlJTeFRRVUZUTEVOQlFVTXNSVUZCUlN4QlFVRkJMRXRCUVVzc1FVRkJRU3hOUVVGTkxFVkJRVVVzWTBGQll5eEZRVUZGTEdGQlFXRXNRMEZCUXl4UFFVRlBMRUZCUVVFc1MwRkJTeXhCUVVGQkxGTkJRVk03UVVGRGNFb3NZVUZCWVN4RFFVRkRMRTlCUVU4c1FVRkJRU3hMUVVGTExFRkJRVUVzVTBGQlV5eEhRVUZITEZGQlFWRXNRMEZCUXl4TFFVRkxMRUZCUVVFc1MwRkJTeXhCUVVGQkxGRkJRVkVzU1VGQlNTeFZRVUZWTEVWQlFVVXNWMEZCVnl4RFFVUnFSanRGUVVkV0xGRkJRVkVzUlVGQlJTeHRRa0ZCYjBJN1JVRkRPVUlzU1VGQlNTeEZRVWhOTEZGQlFVODdSVUZKYWtJc1VVRkJVU3hGUVVGRkxFMUJRVTg3UlVGRGFrSXNTMEZCU3l4RlFVRkZMRWRCUVVrN1JVRkRXQ3hOUVVGTkxFVkJRVVVzUjBGQlNTeEhRVkJFTzBkQlUzbENMRUZCUVVFc1IwRkJReXhEUVVGSkxFdEJRVXNzUVVGQlZDeEZRVUZYTEZOQlFWTXNSMEZCUnl4RlFVRkZMRWRCUVVjc1JVRkJSU3hCUVVGQkxGbEJRVmtzUVVGQlFTeExRVUZMTEVGQlFVRXNUVUZCVFN4RlFVRkZMR05CUVdNc1JVRkJSU3hUUVVGVExFZEJRVWNzUlVGQlJTeEhRVUZITEVWQlFVVXNRVUZCUVN4WlFVRlpMRUZCUVVFc1MwRkJTeXhCUVVGQkxFMUJRVTBzUjBGQlJTeEJRVUZCTEVkQlFVTXNRMEZCU1N4TFFVRkxMRUZCUVZRc1JVRkJWeXhqUVVGakxFZEJRVVVzUVVGQlFTeEhRVUZETEVOQlFVa3NTMEZCU3l4QlFVRlVMRVZCUVZjc1UwRkJVeXhEUVVGRExFVkJRVVVzUVVGQlFTeExRVUZMTEVGQlFVRXNUVUZCVFN4RlFVRkZMR05CUVdNc1JVRkJSU3hUUVVGVExFTkJRVU1zUlVGQlJTeEJRVUZCTEV0QlFVc3NRVUZCUVN4TlFVRk5MRWRCUVVVc1FVRkJRU3hIUVVGRExFTkJRVWtzUzBGQlN5eEJRVUZVTEVWQlFWY3NZMEZCWXl4SFFVRkZMRUZCUVVFc1IwRkJReXhEUVVGSkxFdEJRVXNzUVVGQlZDeEZRVUZYTEdGQlFXRXNRMEZCUXl4UFFVRlBMRUZCUVVFc1MwRkJTeXhCUVVGQkxGTkJRVk1zUjBGQlJ5eGhRVUZoTEVWQlFVTXNRVUZCUVN4SFFVRkRMRU5CUVVrc1MwRkJTeXhCUVVGVUxFVkJRVmNzVDBGQlR5eEJRVUZCTEV0QlFVc3NRVUZCUVN4VFFVRlRPMGRCUTJoWkxFRkJRVUVzUjBGQlF5eERRVUZKTEV0QlFVc3NRVUZCVkN4RlFVRlhMR0ZCUVdFc1EwRkJReXhQUVVGUExFRkJRVUVzUzBGQlN5eEJRVUZCTEZOQlFWTXNSMEZCUnl4aFFVRmhMRVZCUVVNc1FVRkJRU3hIUVVGRExFTkJRVWtzUzBGQlN5eEJRVUZVTEVWQlFWY3NUMEZCVHl4QlFVRkJMRXRCUVVzc1FVRkJRU3hUUVVGVExFbEJRVWNzUVVGQlFTeEhRVUZETEVOQlFVa3NTMEZCU3l4QlFVRlVMRVZCUVZjc1VVRkJVU3hEUVVGRExFdEJRVXNzUVVGQlFTeExRVUZMTEVGQlFVRXNVVUZCVVN4SlFVRkpMRlZCUVZVc1JVRkJSU3hSUVVGUkxFVkJRVU1zUVVGQlFTeEhRVUZETEVOQlFVa3NTMEZCU3l4QlFVRlVMRVZCUVZjc1MwRkJTeXhCUVVGQkxFdEJRVXNzUVVGQlFTeFJRVUZSTEVsQlFVa3NWVUZCVlN4SFFVRkZMRUZCUVVFc1IwRkJReXhEUVVGSkxFdEJRVXNzUVVGQlZDeEZRVUZYTEZkQlFWY3NRMEZFTVU0N1NVRkRZaXhKUVVGSkxFVkJRVVVzU1VGQlN6dEpRVU5ZTEV0QlFVc3NSVUZXU1N4UlFVRlBMRWRCVVVZN08wRkZUbWhDTEdGQlFXRXNRMEZCUXp0RlFVTmlMR1ZCUVdVc1JVRkJSU3hOUVVGUExFZEJSRlk3UlVGUFZpeGhRVUZoTEVOQlFVTXNSVUZCUlN4RlFVRkZMR0ZCUVdFc1EwRkJReXhGUVVGRkxFTkJRUzlDTzBsQlEwNHNWVUZCVlN4RlFVRkZMRU5CUVVVc1IwRkVVRHRKUVVkUUxHRkJRV0VzUTBGQlF5eEZRVUZGTEVOQlFVTXNSVUZCUlN4RlFVRkZMR0ZCUVdFc1EwRkJReXhGUVVGRkxFTkJRVU1zUlVGQlJTeERRVUZ5UXp0TlFVTkdMRTFCUVUwc1JVRkJSU3hMUVVGTExFTkJRVU1zUTBGQlF5eERRVUZETEV0QlFVc3NRMEZCUXl4RFFVRkRMRWRCUkhCQ08wMUJSMFlzWVVGQllTeERRVUZETEVWQlFVVXNRMEZCUXl4RlFVRkZMRUZCUVVFc1dVRkJXU3hGUVVGRkxHRkJRV0VzUTBGQlF5eEZRVUZGTEVOQlFVTXNSVUZCUlN4QlFVRkJMRmxCUVZrc1EwRkJia1E3VVVGRFlpeFZRVUZWTEVWQlFVVXNRMEZCUlN4SFFVUkJPMFZCVDJwQ0xHRkJRV0VzUTBGQlF5eEZRVUZGTEVOQlFXSTdTVUZEUml4aFFVRmhMRVZCUVVVc1NVRkJTeXhIUVVScVFqdEpRVWRHTEdGQlFXRXNRMEZCUXl4RlFVRkZMRUZCUVVFc1ZVRkJWU3hEUVVGbU8wMUJRMWdzVlVGQlZTeEZRVUZGTEVsQlFVc3NSMEZFVER0TlFVZGFMR0ZCUVdFc1EwRkJReXhGUVVGRkxFRkJRVUVzVlVGQlZTeERRVUZETEVWQlFVVXNRMEZCTVVJN1VVRkRSaXhQUVVGUExFVkJRVVVzUzBGQlRUdFJRVU5tTEV0QlFVc3NSVUZCUlN4SlFVRkxMRWRCUmxRN1VVRkpSaXhoUVVGaExFTkJRVU1zUlVGQlJTeEJRVUZCTEZWQlFWVXNRMEZCUXl4RlFVRkZMRUZCUVVFc1QwRkJUeXhEUVVFMVFqdFZRVU5TTEU5QlFVOHNSVUZCUlN4VlFVRlhPMVZCUTNCQ0xHRkJRV0VzUlVGQlJTeExRVUZOTzFWQlEzSkNMRXRCUVVzc1JVRkJSU3hGUVVGSE8xVkJSVllzVDBGQlR5eEZRVUZGTEcxQ1FVRlJMRU5CUVZrc1NVRkJTU3hIUVV4NFFqdFJRVkZVTEdGQlFXRXNRMEZCUXl4RlFVRkZMRUZCUVVFc1ZVRkJWU3hEUVVGRExFVkJRVVVzUVVGQlFTeE5RVUZOTEVOQlFUVkNPMVZCUTFBc1MwRkJTeXhGUVVGRkxFbEJRVXNzUjBGRVNqdEpRVTFZTEdGQlFXRXNRMEZCUXl4RlFVRkZMRU5CUVVNc1JVRkJSU3hEUVVGb1FqdE5RVU5HTEdsQ1FVRnBRaXhGUVVGRkxFbEJRVXNzUjBGRWNrSTdSVUZSVnl4aFFVRmhMRU5CUVVNc1JVRkJSU3hGUVVGRkxHRkJRV0VzUTBGQlF5eEZRVUZGTEVWQlFVVXNZVUZCWVN4RFFVRkRMRVZCUVVVc1JVRkJSU3hoUVVGaExFTkJRVU1zUlVGQlJTeEZRVUZGTEdGQlFXRXNRMEZCUXl4RlFVRkZMRU5CUVhKR08wbEJRVVVzVjBGQlZ5eEZRVUZGTEhkQ1FVRjVRaXhIUVVGMlF6dEZRVU53UWl4aFFVRmhMRU5CUVVNc1JVRkJSU3hEUVVGaU8wbEJRVVVzVTBGQlV5eEZRVUZGTEUxQlFVODdTVUZCUlN4TFFVRkxMRVZJTlVOd1FpeFBRVUZQTEVkSE5FTmlPMFZCUTBvc1lVRkJZU3hEUVVGRExFVkJRVVVzUTBGQllqdEpRVUZGTEZOQlFWTXNSVUZCUlN4TFFVRk5PMGxCUVVVc1MwRkJTeXhGU0RsRGNrSXNUMEZCVHl4SFJ6aERXRHRGUVVOS0xHRkJRV0VzUTBGQlF5eEZRVUZGTEVOQlFXSTdTVUZCUlN4VFFVRlRMRVZCUVVVc1RVRkJUeXhIUVVGdVFqdEZRVU5LTEdGQlFXRXNRMEZCUXl4RlFVRkZMRU5CUVdJN1NVRkJSU3hUUVVGVExFVkJRVVVzUzBGQlRTeEhRVUZzUWp0RlFVTktMR0ZCUVdFc1EwRkJReXhGUVVGRkxFTkJRV0k3U1VGQlJTeFRRVUZUTEVWQlFVVXNTMEZCVFN4SFFVRnNRanM3UVVGSFRDeFZRVUZWTEVOQlFVTTdSVUZEVml4WlFVRlpMRVZCUVVVc1IwRkJTVHRGUVVOc1FpeExRVUZMTEVWSWVFUkpMRTlCUVU4N1JVZDVSR2hDTEZkQlFWY3NSVUZCUlN4SFFVRkhMRU5CUVVNc1MwRkJTeXhEUVVGRExFOUJRVTg3UlVGRE9VSXNVMEZCVXl4RlFVRkZMRTFCUVU4N1JVRkRiRUlzVjBGQlZ5eEZRVUZGTEVOQlFVVXNSMEZNU2pzN1FVRlJXaXhIUVVGSExFTkJRVU03UlVGRFNDeGhRVUZoTEVWQlFVVXNTVUZCU3l4SFFVUm9RanM3UVVGSlRDeFhRVUZYTEVOQlFVTTdSVUZEV0N4TFFVRkxMRVZCUVVVc1MwRkJUVHRGUVVOaUxFMUJRVTBzUlVGQlJTeERRVUZGTEVkQlJrVTdSVUZKV2l4WFFVRlhMRU5CUVVNc1IwRkJSeXhEUVVGWU8wbEJRMGdzVjBGQlZ5eEZRVUZGTEVkQlFVa3NSMEZFWWpzN1FVRkxUaXhWUVVGVkxFTkJRVU03UlVGRFZpeExRVUZMTEVWQlFVVXNTVUZCU3p0RlFVTmFMRTFCUVUwc1JVRkJSU3hEUVVGRkxFZEJSa003UlVGSldDeFZRVUZWTEVOQlFVTXNSMEZCUnl4RFFVRldPMGxCUTBnc1dVRkJXU3hGUVVGRkxFZEJRVWtzUjBGRVpEczdRVUZMVGl4TFFVRkxMRU5CUVVNN1JVRkRUQ3hUUVVGVExFVkJRVVVzUzBGQlRUdEZRVU5xUWl4VlFVRlZMRVZCUVVVc1NVRkJTeXhIUVVaWU8wVkJTVVlzUzBGQlN5eERRVUZETEVWQlFVVXNSVUZCUlN4TFFVRkxMRU5CUVVNc1JVRkJSU3hEUVVGbU8wbEJRMDRzVDBGQlR5eEZRVUZGTEV0QlFVMHNSMEZFVWp0RlFVbFNMRXRCUVVzc1EwRkJReXhGUVVGRkxFTkJRVXc3U1VGRFJpeGpRVUZqTEVWQlFVVXNSMEZCU1N4SFFVUnFRanRGUVVsTExFdEJRVXNzUTBGQlF5eEZRVUZGTEVGQlFVRXNUVUZCVFN4RFFVRkRMRVZCUVVVc1EwRkJaRHRKUVVOWUxFdEJRVXNzUlVndlJrVXNUMEZCVHl4SFJ6aEdSanRGUVVsaUxFdEJRVXNzUTBGQlF5eEZRVUZGTEVOQlFVdzdTVUZEUml4aFFVRmhMRVZCUVVVc1IwRkJSeXhEUVVGRExFdEJRVXNzUTBodVIycENMRTlCUVU4N1NVZHZSMlFzVjBGQlZ5eEZRVUZGTEVsQlFVczdTVUZEYkVJc1kwRkJZeXhGUVVGRkxFMUJRMmhDTEVkQlNrYzdSVUZOUVN4TFFVRkxMRU5CUVVNc1JVRkJSU3hGUVVGRkxFdEJRVXNzUTBGQlF5eEZRVUZGTEVOQlFXWTdTVUZEVGl4WlFVRlpMRVZCUVVVc1NVRkJTeXhIUVVSYU96dEJRVXRVTEU5QlFVOHNRMEZCUXp0RlFVTlFMRTFCUVUwc1JVRkJSU3hMUVVGTk8wVkJRMlFzVDBGQlR5eEZRVUZGTEV0QlFVMDdSVUZEWml4UFFVRlBMRVZCUVVVc1IwRkJTU3hIUVVoTU96dEJRVTFVTEdOQlFXTXNRMEZCUXp0RlFVTmtMRmRCUVZjc1JVRkJSU3d5UWtGQk5FSXNSMEZFTVVJN08wRkJTV2hDTEdsQ1FVRnBRaXhEUVVGRE8wVkJRMnBDTEZkQlFWY3NSVUZCUlN4dlFrRkJjVUk3UlVGRGJFTXNWMEZCVnl4RlFVRkZMRWxCUVVzN1JVRkRiRUlzVTBGQlV5eEZRVUZGTEV0QlFVMHNSMEZJUXpzN1FVRk5TQ3hoUVVGaExFZEJRVWNzUlVGQlJTeERRVUZtTzBWQlEyaENMRTlCUVU4c1JVRkJSU3haUVVGaE8wVkJRM1JDTEZWQlFWVXNSVUZCUlN4VlFVRlhPMFZCUTNaQ0xFdEJRVXNzUlVGQlJTeEhRVUZKTzBWQlEySXNUVUZCVFN4RlFVRkZMR3RDUVVGdFFpeEhRVXBTT3p0QlFVOXdRaXhsUVVGbExFTkJRVU03UlVGRFppeFRRVUZUTEVWQlFVVXNSMEZCU1N4SFFVUkRPenRCUVV0YUxFOUJRVThzUTBGQlF5eEZRVUZGTEVWQlFVVXNUMEZCVHl4RFFVRkRMRVZCUVVVc1EwRkJia0k3UlVGRFRpeFZRVUZWTEVWQlFVVXNWVUZCVnp0RlFVTjJRaXhMUVVGTExFVkJRVVVzUjBGQlNUdEZRVU5ZTEU5QlFVOHNSVUZCUlN4SFFVRkpPMFZCUTJJc1kwRkJZeXhGUVVGRkxFMUJRVThzUjBGS2FFSTdSVUZOVGl4UFFVRlBMRU5CUVVNc1JVRkJSU3hCUVVGQkxGbEJRVmtzUlVGQlJTeFBRVUZQTEVOQlFVTXNSVUZCUlN4QlFVRkJMRmxCUVZrc1EwRkJha003U1VGRFlpeFpRVUZaTEVWQlFVVXNSMEZCUnl4RFFVRkRMRXRCUVVzc1EwaG9TbXBDTEU5QlFVOHNSMGNyU1VNN08wRkJTMEVzVDBGQlR5eERRVUZETEVWQlFVVXNRVUZCUVN4WlFVRlpMRVZCUVVVc1QwRkJUeXhEUVVGRExFVkJRVVVzUTBGQkwwSTdSVUZEYkVJc1ZVRkJWU3hGUVVGRkxFMUJRVThzUjBGRVFUczdRVUZMY2tJc1VVRkJVU3hEUVVGRE8wVkJRMUlzWVVGQllTeEZRVUZGTEVkQlFVa3NSMEZFVmpzN1FVbzVTbFlzU1VGQlNTeERRVUZETzBWQlEwb3NWMEZCVnl4RlFVRkZMSEZDUVVGelFqdEZRVU51UXl4TFFVRkxMRVZEUlVjc1QwRkJUenRGUkVSbUxHZENRVUZuUWl4RlEwUk1MRTlCUVU4c1IwUkdZanM3UVVGVlRpeGhRVUZoTEVOQlFVTTdSVUZEWWl4TFFVRkxMRVZCUVVVc1NVRkJTenRGUVVOYUxGTkJRVk1zUlVGQlJTeEhRVUZKTzBWQlEyWXNUVUZCVFN4RlFVRkZMRTFCUVU4c1IwRklSRHM3UVVGTlppeFRRVUZUTEVOQlFVTTdSVUZEVkN4UFFVRlBMRVZCUVVVc1MwRkJUVHRGUVVObUxGVkJRVlVzUlVGQlJTeE5RVUZQTzBWQlEyNUNMR0ZCUVdFc1JVRkJSU3hIUVVGSkxFZEJTRlFpTEFvSkltNWhiV1Z6SWpvZ1cxMEtmUT09ICov');;
},{"sassify":19}],69:[function(require,module,exports){
(function (process){
'use strict';

require('normalize.css/normalize.css');
require('./style/index.scss');

var catchLinks = require('catch-links'),
    main = require('main-loop'),
    singlePage = require('single-page'),
    virtualDom = require('virtual-dom'),
    xtend = require('xtend');

var load = require('./page-loader'),
    read = require('./page-reader');

load().then(function (data) {
	var state = {};

	var loop = main(state, render, virtualDom);
	var show = singlePage(function (href) {
		if (href === '/') {
			href = '/#Introduction';
		}

		if (href.length > 2 && href.slice(0, 2) !== '/#') {
			window.location = href;
		}

		loop.update(xtend(state, { path: href }));
	});
	catchLinks(window, show);

	var target = document.querySelector('.page-place');
	target.parentNode.replaceChild(loop.target, target);

	function render(state) {
		return read(data, state);
	}

	process.nextTick(function () {
		var page = window.location.hash || '#Introduction';
		show('/' + page);
	});
});

}).call(this,require('_process'))
},{"./page-loader":66,"./page-reader":67,"./style/index.scss":68,"_process":3,"catch-links":9,"main-loop":11,"normalize.css/normalize.css":18,"single-page":1,"virtual-dom":34,"xtend":65}]},{},[69]);
