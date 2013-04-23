(function() {
  'use strict';

  var L20n = {
    Context: Context,
    getContext: function L20n_getContext(id) {
      return new Context(id);
    },
  };

  function Resource(id, parser) {
    var self = this;

    this.id = id;
    this.resources = [];
    this.source = null;
    this.isReady = false;
    this.ast = {
      type: 'LOL',
      body: [],
    };

    this.build = build;

    var _imports_positions = [];

    function build(nesting, async) {
      if (nesting >= 7) {
        throw new ContextError("Too many nested imports.");
      }
      if (!async) {
        fetch(async);
        parse();
        buildImports(nesting + 1, async);
        flatten();
        return;
      }
      return fetch(async)
        .then(parse)
        .then(buildImports.bind(this, nesting + 1, async))
        .then(flatten);
    }

    function fetch(async) {
      if (!async) {
        if (!self.source) {
          self.source = L20n.IO.loadSync(self.id);
        }
        return;
      }
      if (self.source) {
        var source = new L20n.Promise();
        source.fulfill();
        return source;
      }
      return L20n.IO.loadAsync(self.id).then(function load_success(text) {
        self.source = text;
      });
    }

    function parse() {
      self.ast = parser.parse(self.source);
    }

    function buildImports(nesting, async) {
      var imports = self.ast.body.filter(function(elem, i) {
        if (elem.type == 'ImportStatement') {
          _imports_positions.push(i);
          return true;
        }
        return false;
      });

      imports.forEach(function(imp) {
        var uri = relativeToSelf(imp.uri.content);
        var res = new Resource(uri, parser);
        self.resources.push(res);
      });

      var imports_built = [];
      self.resources.forEach(function(res) {
        imports_built.push(res.build(nesting, async));
      });

      if (async) {
        return L20n.Promise.all(imports_built);
      }
    }

    function flatten() {
      for (var i = self.resources.length-1; i >= 0; i--) {
        var pos = _imports_positions[i] || 0;
        Array.prototype.splice.apply(self.ast.body,
          [pos, 1].concat(self.resources[i].ast.body));
      }
      self.isReady = true;
    }

    function relativeToSelf(url) {
      if (self.id === null || url[0] == '/') {
        return url;
      } 
      var dirname = self.id.split('/').slice(0, -1).join('/');
      if (dirname) {
        // strip the trailing slash if present
        if (dirname[dirname.length - 1] == '/') {
          dirname = dirname.slice(0, dirname.length - 1);
        }
        return dirname + '/' + url;
      } else {
        return './' + url;
      }
    }

  }

  function Locale(id, parser, compiler) {
    this.id = id;
    this.resources = [];
    this.entries = null;
    this.ast = {
      type: 'LOL',
      body: [],
    };
    this.isReady = false;

    this.build = build;
    this.getEntry = getEntry;

    var self = this;

    function build(async) {
      if (!async) {
        buildResources(async);
        flatten();
        compile();
        return this;
      }
      return buildResources(async)
        .then(flatten)
        .then(compile);
    }

    function buildResources(async) {
      var resources_built = [];
      self.resources.forEach(function(res) {
        resources_built.push(res.build(0, async));
      });
      if (async) {
        return L20n.Promise.all(resources_built);
      }
    }

    function flatten() {
      self.ast.body = self.resources.reduce(function(prev, curr) {
        return prev.concat(curr.ast.body);
      }, self.ast.body);
    }

    function compile() {
      self.entries = compiler.compile(self.ast);
      self.isReady = true;
    }

    function getEntry(id) { 
      if (this.entries.hasOwnProperty(id)) {
        return this.entries[id];
      }
      return undefined;
    }
  }

  function Context(id) {

    this.id = id;
    this.data = {};

    this.addResource = addResource;
    this.linkResource = linkResource;
    this.registerLocales = registerLocales;
    this.freeze = freeze;

    this.get = get;
    this.getEntity = getEntity;
    this.localize = localize;

    this.addEventListener = addEventListener;
    this.removeEventListener = removeEventListener;

    // all languages registered as available (list of codes)
    var _available = [];
    var _locales = {};
    // a special Locale for resources not associated with any other
    var _none;

    var _isFrozen = false;
    var _isReady = false;
    var _emitter = new L20n.EventEmitter();
    var _parser = new L20n.Parser(L20n.EventEmitter);
    var _compiler = new L20n.Compiler(L20n.EventEmitter, L20n.Parser);

    var _globalsManager = new L20n.GlobalsManager();

    var _listeners = [];

    _parser.addEventListener('error', echo);
    _compiler.addEventListener('error', echo);
    _compiler.setGlobals(_globalsManager.globals);

    function get(id, data, callback) {
      if (!_isReady) {
        if (!callback) {
          throw new ContextError("Context not ready");
        }
        return this.addEventListener('ready', 
                                     get.bind(this, id, data, callback));
      }
      var entity = getFromLocale(0, id, data);
      if (callback) {
        callback(entity.value);
        _globalsManager.bindGet({
          'id': callback,
          'callback': get.bind(this, id, data, callback),
          'globals': entity.globals});
      }
      return entity.value;
    }

    function getEntity(id, data, callback) {
      if (!_isReady) {
        if (!callback) {
          throw new ContextError("Context not ready");
        }
        return this.addEventListener('ready', 
                                     getEntity.bind(this, id, data, callback));
      }
      var entity = getFromLocale(0, id, data);
      if (callback) {
        callback(entity);
        _globalsManager.bindGet({
          'id': callback,
          'callback': getEntity.bind(this, id, data, callback),
          'globals': entity.globals});
      }
      return entity;
    }

    function localize(idsOrTuples, callback) {
      if (!_isReady) {
        if (!callback) {
          throw new ContextError("Context not ready");
        }
        return this.addEventListener('ready',
                                     getMany.bind(this, idsOrTuples, data, callback));
      }
      return getMany(idsOrTuples, callback);
    }

    function getMany(idsOrTuples, callback) {
      var vals = {};
      var globalsUsed = {};
      var id;
      for (var i = 0, iot; iot = idsOrTuples[i]; i++) {
        if (Array.isArray(iot)) {
          id = iot[0];
          vals[id] = getEntity(iot[0], iot[1]);
        } else {
          id = iot;
          vals[id] = getEntity(iot);
        }
        for (var global in vals[id].globals) {
          if (vals[id].globals.hasOwnProperty(global)) {
            globalsUsed[global] = true;
          }
        }
      }
      var retobj = {
        'entities': vals
      };
      if (callback) {
        callback(retobj);
        _globalsManager.bindGet({
          'id': callback,
          'callback': getMany.bind(this, idsOrTuples, callback),
          'globals': Object.keys(globalsUsed)});
      }
      return retobj;
    }

    function getLocale(i) {
      // if we're out of locales from `_available`, resort to `_none`
      if (_available.length - i == 0) {
        return _none;
      }
      return  _locales[_available[i]];
    }

    function getFromLocale(cur, id, data, sourceString) {
      var locale = getLocale(cur);

      if (!locale) {
        var ex = new GetError("Entity couldn't be retrieved", id, _available);
        _emitter.emit('error', ex);
        // imitate the return value of Compiler.Entity.get
        return {
          value: sourceString ? sourceString : id,
          attributes: {},
          globals: {}
        };
      }

      if (!locale.isReady) {
        locale.build(false);
      }

      var entry = locale.getEntry(id);

      // if the entry is missing, just go to the next locale immediately
      if (entry === undefined) {
        _emitter.emit('error', new EntityError("Not found", id, locale.id));
        return getFromLocale(cur + 1, id, data, sourceString);
      }

      // otherwise, try to get the value of the entry
      try {
        return entry.get(getArgs.bind(this, data));
      } catch(e) {
        if (e instanceof L20n.Compiler.RuntimeError) {
          _emitter.emit('error', new EntityError(e.message, id, locale.id));
          return getFromLocale(cur + 1, id, data, sourceString || e.source);
        } else {
          throw e;
        }
      }
    }

    function getArgs(data) {
      if (!data) {
        return this.data;
      }
      var args = {};
      for (var i in this.data) {
        if (this.data.hasOwnProperty(i)) {
          args[i] = this.data[i];
        }
      }
      if (data) {
        for (i in data) {
          if (data.hasOwnProperty(i)) {
            args[i] = data[i];
          }
        }
      }
      return args;
    }

    function addResource(text) {
      if (_available.length === 0) {
        _none = new Locale(null, _parser, _compiler);
      } else {
        // XXX should addResource add the text to all locales in the multilocale 
        // mode?  or throw?
        throw new ContextError("Can't use addResource with registered languages");
      }
      var res = new Resource(null, _parser);
      res.source = text;
      _none.resources.push(res);
    }

    function linkResource(uri) {
      if (typeof uri === 'function') {
        return linkTemplate(uri);
      } else {
        return linkURI(uri);
      }
    }

    function linkTemplate(uriTemplate) {
      if (_available.length === 0) {
        throw new ContextError("No registered languages");
      }
      for (var lang in _locales) {
        var res = new Resource(uriTemplate(lang), _parser);
        // XXX detect if the resource has been already added?
        _locales[lang].resources.push(res);
      }
      return true;
    }

    function linkURI(uri) {
      var res = new Resource(uri, _parser);
      if (_available.length !== 0) {
        for (var lang in _locales) {
          _locales[lang].resources.push(res);
        }
        return true;
      }
      if (_none === undefined) {
        _none = new Locale(null, _parser, _compiler);
      }
      _none.resources.push(res);
      return true;
    }

    function registerLocales() {
      for (var i in arguments) {
        var lang = arguments[i];
        _available.push(lang);
        _locales[lang] = new Locale(lang, _parser, _compiler);
      }
    }

    function freeze() {
      _isFrozen = true;
      var locale = _available.length > 0 ? _locales[_available[0]] : _none;
      return locale.build(true).then(setReady);
    }

    function setReady() {
      _isReady = true;
      _emitter.emit('ready');
    }

    function addEventListener(type, listener) {
      _emitter.addEventListener(type, listener);
    }

    function removeEventListener(type, listener) {
      _emitter.removeEventListener(type, listener);
    }

    function echo(e) {
      _emitter.emit('error', e);
    }
}

  Context.Error = ContextError;
  Context.EntityError = EntityError;

  function ContextError(message) {
    this.name = 'ContextError';
    this.message = message;
  }
  ContextError.prototype = Object.create(Error.prototype);
  ContextError.prototype.constructor = ContextError;

  function EntityError(message, id, lang) {
    ContextError.call(this, message);
    this.name = 'EntityError';
    this.id = id;
    this.lang = lang;
    this.message = '[' + lang + '] ' + id + ': ' + message;
  }
  EntityError.prototype = Object.create(ContextError.prototype);
  EntityError.prototype.constructor = EntityError;

  function GetError(message, id, langs) {
    ContextError.call(this, message);
    this.name = 'GetError';
    this.id = id;
    this.tried = langs;
    if (langs.length) {
      this.message = id + ': ' + message + '; tried ' + langs.join(', ');
    } else {
      this.message = id + ': ' + message;
    }
  }
  GetError.prototype = Object.create(ContextError.prototype);
  GetError.prototype.constructor = GetError;

  this.L20n = L20n;

}).call(this);
/**
 * @class A promise - value to be resolved in the future.
 * Implements the "Promises/A+" specification.
 */
(function() {
  'use strict';
var Promise = function() {
	this._state = 0; /* 0 = pending, 1 = fulfilled, 2 = rejected */
	this._value = null; /* fulfillment / rejection value */

	this._cb = {
		fulfilled: [],
		rejected: []
	}

	this._thenPromises = []; /* promises returned by then() */
}

Promise.all = function(list) {
  var pr = new Promise();
  var toResolve = list.length;
  if (toResolve == 0) {
    pr.fulfill();
    return pr;
  }
  function onResolve() {
    toResolve--;
    if (toResolve == 0) {
      pr.fulfill();
    }
  }
  for (var idx in list) {
    // XXX should there be a different callback for promises errorring out?
    // with two onResolve callbacks, all() is more like some().
    list[idx].then(onResolve, onResolve);
  }
  return pr;
}

/**
 * @param {function} onFulfilled To be called once this promise gets fulfilled
 * @param {function} onRejected To be called once this promise gets rejected
 * @returns {Promise}
 */
Promise.prototype.then = function(onFulfilled, onRejected) {
	this._cb.fulfilled.push(onFulfilled);
	this._cb.rejected.push(onRejected);

	var thenPromise = new Promise();

	this._thenPromises.push(thenPromise);

	if (this._state > 0) {
		setTimeout(this._processQueue.bind(this), 0);
	}

	/* 3.2.6. then must return a promise. */
	return thenPromise; 
}

/**
 * Fulfill this promise with a given value
 * @param {any} value
 */
Promise.prototype.fulfill = function(value) {
	if (this._state != 0) { return this; }

	this._state = 1;
	this._value = value;

	this._processQueue();

	return this;
}

/**
 * Reject this promise with a given value
 * @param {any} value
 */
Promise.prototype.reject = function(value) {
	if (this._state != 0) { return this; }

	this._state = 2;
	this._value = value;

	this._processQueue();

	return this;
}

Promise.prototype._processQueue = function() {
	while (this._thenPromises.length) {
		var onFulfilled = this._cb.fulfilled.shift();
		var onRejected = this._cb.rejected.shift();
		this._executeCallback(this._state == 1 ? onFulfilled : onRejected);
	}
}

Promise.prototype._executeCallback = function(cb) {
	var thenPromise = this._thenPromises.shift();

	if (typeof(cb) != "function") {
		if (this._state == 1) {
			/* 3.2.6.4. If onFulfilled is not a function and promise1 is fulfilled, promise2 must be fulfilled with the same value. */
			thenPromise.fulfill(this._value);
		} else {
			/* 3.2.6.5. If onRejected is not a function and promise1 is rejected, promise2 must be rejected with the same reason. */
			thenPromise.reject(this._value);
		}
		return;
	}

	try {
		var returned = cb(this._value);

		if (returned && typeof(returned.then) == "function") {
			/* 3.2.6.3. If either onFulfilled or onRejected returns a promise (call it returnedPromise), promise2 must assume the state of returnedPromise */
			var fulfillThenPromise = function(value) { thenPromise.fulfill(value); }
			var rejectThenPromise = function(value) { thenPromise.reject(value); }
			returned.then(fulfillThenPromise, rejectThenPromise);
		} else {
			/* 3.2.6.1. If either onFulfilled or onRejected returns a value that is not a promise, promise2 must be fulfilled with that value. */ 
			thenPromise.fulfill(returned);
		}

	} catch (e) {

		/* 3.2.6.2. If either onFulfilled or onRejected throws an exception, promise2 must be rejected with the thrown exception as the reason. */
		thenPromise.reject(e); 

	}
}

this.L20n.Promise = Promise;
}).call(this);
(function() {
  'use strict';

  var IO = {
    load: function load(url, async) {
      if (async) {
        return this.loadAsync(url);
      }
      return this.loadSync(url);
    },
    loadAsync: function(url) {
      var deferred = new L20n.Promise();
      var xhr = new XMLHttpRequest();
      xhr.overrideMimeType('text/plain');
      xhr.addEventListener('load', function() {
        if (xhr.status == 200) {
          deferred.fulfill(xhr.responseText);
        } else {
          deferred.reject();
        }
      });
      xhr.addEventListener('abort', function(e) {
        return deferred.reject(e);
      });
      xhr.open('GET', url, true);
      xhr.send('');
      return deferred;
    },

    loadSync: function(url) {
      var deferred = new L20n.Promise();
      var xhr = new XMLHttpRequest();
      xhr.overrideMimeType('text/plain');
      xhr.open('GET', url, false);
      xhr.send('');
      if (xhr.status == 200) {
        return xhr.responseText;
      } else {
        // XXX should this fail more horribly?
        return '';
      }
    },
  }

  this.L20n.IO = IO;

}).call(this);
(function() {
  'use strict';

  function Parser(Emitter) {

    /* Public */

    this.parse = parse;
    this.parseString = parseString;
    this.addEventListener = addEventListener;
    this.removeEventListener = removeEventListener;

    /* Private */

    var _source, _index, _length, _emitter;

    /* Depending on if we have emitter choose prop getLOL method */
    var getLOL;
    if (Emitter) {
      _emitter = new Emitter();
      getLOL = getLOLWithRecover;
    } else {
      getLOL = getLOLPlain;
    }

    function getComment() {
      _index += 2;
      var start = _index;
      var end = _source.indexOf('*/', start);
      if (end === -1) {
        throw error('Comment without closing tag');
      }
      _index = end + 2;
      return {
        type: 'Comment',
        content: _source.slice(start, end)
      };
    }

    function getAttributes() {
      var attrs = [];
      var attr, ws1, ch;
 
      while (true) {
        attr = getKVPWithIndex();
        attr.local = attr.key.name.charAt(0) === '_';
        attrs.push(attr);
        ws1 = getRequiredWS();
        ch = _source.charAt(_index);
        if (ch === '>') {
          break;
        } else if (!ws1) {
          throw error('Expected ">"');
        }
      }
      return attrs;
    }

    function getKVP(type) {
      var key = getIdentifier();
      getWS();
      if (_source.charAt(_index) !== ':') {
        throw error('Expected ":"');
      }
      ++_index;
      getWS();
      return {
        type: type,
        key: key,
        value: getValue()
      };
    }

    function getKVPWithIndex(type) {
      var key = getIdentifier();
      var index = [];

      if (_source.charAt(_index) === '[') {
        ++_index;
        getWS();
        index = getItemList(getExpression, ']');
      }
      getWS();
      if (_source.charAt(_index) !== ':') {
        throw error('Expected ":"');
      }
      ++_index;
      getWS();
      return {
        type: type,
        key: key,
        value: getValue(),
        index: index
      };
    }

    function getHash() {
      ++_index;
      getWS();
      if (_source.charAt(_index) === '}') {
        ++_index;
        return {
          type: 'Hash',
          content: []
        };
      }

      var defItem, hi, comma, hash = [];
      while (true) {
        defItem = false;
        if (_source.charAt(_index) === '*') {
          ++_index;
          if (defItem) {
            throw error('Default item redefinition forbidden');
          }
          defItem = true;
        }
        hi = getKVP('HashItem');
        hi['default'] = defItem;
        hash.push(hi);
        getWS();

        comma = _source.charAt(_index) === ',';
        if (comma) {
          ++_index;
          getWS();
        }
        if (_source.charAt(_index) === '}') {
          ++_index;
          break;
        }
        if (!comma) {
          throw error('Expected "}"');
        }
      }
      return {
        type: 'Hash',
        content: hash
      };
    }

    function getString(opchar) {
      var len = opchar.length;
      var start = _index + len;

      var close = _source.indexOf(opchar, start);
      // we look for a closing of the string here
      // and then we check if it's preceeded by '\'
      // 92 == '\'
      while (close !== -1 &&
             _source.charCodeAt(close - 1) === 92 &&
             _source.charCodeAt(close - 2) !== 92) {
        close = _source.indexOf(opchar, close + len);
      }
      if (close === -1) {
        throw error('Unclosed string literal');
      }
      var str = _source.slice(start, close);

      _index = close + len;
      return {
        type: 'String',
        content: str
      };
    }

    function getValue(optional, ch) {
      if (ch === undefined) {
        ch = _source.charAt(_index);
      }
      if (ch === "'" || ch === '"') {
        if (ch === _source.charAt(_index + 1) && ch === _source.charAt(_index + 2)) {
          return getString(ch + ch + ch);
        }
        return getString(ch);
      }
      if (ch === '{') {
        return getHash();
      }
      if (!optional) {
        throw error('Unknown value type');
      }
      return null;
    }


    function getRequiredWS() {
      var pos = _index;
      var cc = _source.charCodeAt(pos);
      // space, \n, \t, \r
      while (cc === 32 || cc === 10 || cc === 9 || cc === 13) {
        cc = _source.charCodeAt(++_index);
      }
      return _index !== pos;
    }

    function getWS() {
      var cc = _source.charCodeAt(_index);
      // space, \n, \t, \r
      while (cc === 32 || cc === 10 || cc === 9 || cc === 13) {
        cc = _source.charCodeAt(++_index);
      }
    }

    function getVariable() {
      ++_index;
      return {
        type: 'VariableExpression',
        id: getIdentifier()
      };
    }

    function getIdentifier() {
      var index = _index;
      var start = index;
      var source = _source;
      var cc = source.charCodeAt(start);

      // a-zA-Z_
      if ((cc < 97 || cc > 122) && (cc < 65 || cc > 90) && cc !== 95) {
        throw error('Identifier has to start with [a-zA-Z]');
      }

      cc = source.charCodeAt(++index);
      while ((cc >= 95 && cc <= 122) || // a-z
             (cc >= 65 && cc <= 90) ||  // A-Z
             (cc >= 48 && cc <= 57) ||  // 0-9
             cc === 95) {               // _
        cc = source.charCodeAt(++index);
      }
      _index += index - start;
      return {
        type: 'Identifier',
        name: source.slice(start, index)
      };
    }

    function getImportStatement() {
      _index += 6;
      if (_source.charAt(_index) !== '(') {
        throw error('Expected "("');
      }
      ++_index;
      getWS();
      var uri = getString(_source.charAt(_index));
      getWS();
      if (_source.charAt(_index) !== ')') {
        throw error('Expected ")"');
      }
      ++_index;
      return {
        type: 'ImportStatement',
        uri: uri
      };
    }

    function getMacro(id) {
      if (id.name.charAt(0) === '_') {
        throw error('Macro ID cannot start with "_"');
      }
      ++_index;
      var idlist = getItemList(getVariable, ')');
      getRequiredWS();

      if (_source.charAt(_index) !== '{') {
        throw error('Expected "{"');
      }
      ++_index;
      getWS();
      var exp = getExpression();
      getWS();
      if (_source.charAt(_index) !== '}') {
        throw error('Expected "}"');
      }
      ++_index;
      getWS();
      if (_source.charCodeAt(_index) !== 62) {
        throw error('Expected ">"');
      }
      ++_index;
      return {
        type: 'Macro',
        id: id,
        args: idlist,
        expression: exp,
      };
    }

    function getEntity(id, index) {
      if (!getRequiredWS()) {
        throw error('Expected white space');
      }

      var ch = _source.charAt(_index);
      var value = getValue(true, ch);
      var attrs = [];
      if (value === null) {
        if (ch !== '>') {
          attrs = getAttributes();
        } else {
          throw error('Expected ">"');
        }
      } else {
        var ws1 = getRequiredWS();
        if (_source.charAt(_index) !== '>') {
          if (!ws1) {
            throw error('Expected ">"');
          }
          attrs = getAttributes();
        }
      }
      getWS();

      // skip '>'
      ++_index;
      return {
        type: 'Entity',
        id: id,
        value: value,
        index: index,
        attrs: attrs,
        local: (id.name.charCodeAt(0) === 95) // _
      };
    }

    function getEntry() {
      var cc = _source.charCodeAt(_index);

      // 60 == '<'
      if (cc === 60) {
        ++_index;
        var id = getIdentifier();
        cc = _source.charCodeAt(_index);
        // 40 == '('
        if (cc === 40) {
          return getMacro(id);
        }
        // 91 == '['
        if (cc === 91) {
          ++_index;
          return getEntity(id,
                           getItemList(getExpression, ']'));
        }
        return getEntity(id, []);
      }
      // 47, 42 == '/*'
      if (_source.charCodeAt(_index) === 47 &&
                 _source.charCodeAt(_index + 1) === 42) {
        return getComment();
      }
      if (_source.slice(_index, _index + 6) === 'import') {
        return getImportStatement();
      }
      throw error('Invalid entry');
    }

    function getComplexString() {
      /*
       * This is a very complex function, sorry for that
       *
       * It basically parses a string looking for:
       *   - expression openings: {{
       *   - escape chars: \
       * 
       * And if it finds any it deals with them.
       * The result is quite fast, except for getExpression which as
       * of writing does a poor job at nesting many functions in order
       * to get to the most common type - Identifier.
       *
       * We can fast path that, we can rewrite expression engine to minimize
       * function nesting or we can wait for engines to become faster.
       *
       * For now, it's fast enough :)
       */
      var nxt;                    // next char in backslash case
      var body;                   // body of a complex string
      var bstart = _index;        // buffer start index
      var complex = false;

      // unescape \\ \' \" \{{
      var pos = _source.indexOf('\\');
      while (pos !== -1) {
        nxt = _source.charAt(pos + 1);
        if (nxt == '"' ||
            nxt == "'" ||
            nxt == '\\') {
          _source = _source.substr(0, pos) + _source.substr(pos + 1);
        }
        pos = _source.indexOf('\\', pos + 1);
      }

      // parse expressions
      pos = _source.indexOf('{{');
      while (pos !== -1) {
        // except if the expression is prefixed with \
        // in that case skip it
        if (_source.charCodeAt(pos - 1) === 92) {
          _source = _source.substr(0, pos - 1) + _source.substr(pos);
          pos = _source.indexOf('{{', pos + 2);
          continue;
        }
        if (!complex) {
          body = [];
          complex = true;
        }
        if (bstart < pos) {
          body.push({
            type: 'String',
            content: _source.slice(bstart, pos)
          });
        }
        _index = pos + 2;
        getWS();
        body.push(getExpression());
        getWS();
        if (_source.charCodeAt(_index) !== 125 ||
            _source.charCodeAt(_index+1) !== 125) {
          throw error('Expected "}}"');
        }
        pos = _index + 2;
        bstart = pos;
        pos = _source.indexOf('{{', pos);
      }

      // if complexstring is just one string, return it instead
      if (!complex) {
        return {
          type: 'String',
          content: _source
        };
      }

      // if there's leftover string we pick it
      if (bstart < _length) {
        body.push({
          type: 'String',
          content: _source.slice(bstart)
        });
      }
      return {
        type: 'ComplexString',
        content: body
      };
    }

    function getLOLWithRecover() {
      var entries = [];

      getWS();
      while (_index < _length) {
        try {
          entries.push(getEntry());
        } catch (e) {
          if (e instanceof ParserError) {
            _emitter.emit('error', e);
            entries.push(recover());
          } else {
            throw e;
          }
        }
        if (_index < _length) {
          getWS();
        }
      }

      return {
        type: 'LOL',
        body: entries
      };
    }

    function getLOLPlain() {
      var entries = [];

      getWS();
      while (_index < _length) {
        entries.push(getEntry());
        if (_index < _length) {
          getWS();
        }
      }

      return {
        type: 'LOL',
        body: entries
      };
    }

    /* Public API functions */

    function parseString(string) {
      _source = string;
      _index = 0;
      _length = _source.length;
      try {
        return getComplexString();
      } catch (e) {
        if (Emitter && e instanceof ParserError) {
          _emitter.emit('error', e);
        }
        throw e;
      }
    }

    function parse(string) {
      _source = string;
      _index = 0;
      _length = _source.length;

      return getLOL();
    }

    function addEventListener(type, listener) {
      if (!_emitter) {
        throw Error("Emitter not available");
      }
      return _emitter.addEventListener(type, listener);
    }

    function removeEventListener(type, listener) {
      if (!_emitter) {
        throw Error("Emitter not available");
      }
      return _emitter.removeEventListener(type, listener);
    }

    /* Expressions */

    function getExpression() {
      return getConditionalExpression();
    }

    function getPrefixExpression(token, cl, op, nxt) {
      var exp = nxt();
      var t, ch;
      while (true) {
        t = '';
        getWS();
        ch = _source.charAt(_index);
        if (token[0].indexOf(ch) === -1) {
          break;
        }
        t += ch;
        ++_index;
        if (token.length > 1) {
          ch = _source.charAt(_index);
          if (token[1] == ch) {
            ++_index;
            t += ch;
          } else if (token[2]) {
            --_index;
            return exp;
          }
        }
        getWS();
        exp = {
          type: cl,
          operator: {
            type: op,
            token: t
          },
          left: exp,
          right: nxt()
        };
      }
      return exp;
    }

    function getPostfixExpression(token, cl, op, nxt) {
      var cc = _source.charCodeAt(_index);
      if (token.indexOf(cc) === -1) {
        return nxt();
      }
      ++_index;
      getWS();
      return {
        type: cl,
        operator: {
          type: op,
          token: String.fromCharCode(cc)
        },
        argument: getPostfixExpression(token, cl, op, nxt)
      };
    }

    function getConditionalExpression() {
      var exp = getOrExpression();
      getWS();
      if (_source.charCodeAt(_index) !== 63) { // ?
        return exp;
      }
      ++_index;
      getWS();
      var consequent = getExpression();
      getWS();
      if (_source.charCodeAt(_index) !== 58) { // :
        throw error('Expected ":"');
      }
      ++_index;
      getWS();
      return {
        type: 'ConditionalExpression',
        test: exp,
        consequent: consequent,
        alternate: getExpression()
      };
    }

    function getOrExpression() {
      return getPrefixExpression([['|'], '|', true],
                                 'LogicalExpression',
                                 'LogicalOperator',
                                 getAndExpression);
    }

    function getAndExpression() {
      return getPrefixExpression([['&'], '&', true],
                                 'LogicalExpression',
                                 'Logicalperator',
                                 getEqualityExpression);
    }

    function getEqualityExpression() {
      return getPrefixExpression([['='], '=', true],
                                 'BinaryExpression',
                                 'BinaryOperator',
                                 getRelationalExpression);
    }

    function getRelationalExpression() {
      return getPrefixExpression([['<', '>'], '=', false],
                                 'BinaryExpression',
                                 'BinaryOperator',
                                 getAdditiveExpression);
    }

    function getAdditiveExpression() {
      return getPrefixExpression([['+', '-']],
                                 'BinaryExpression',
                                 'BinaryOperator',
                                 getModuloExpression);
    }

    function getModuloExpression() {
      return getPrefixExpression([['%']],
                                 'BinaryExpression',
                                 'BinaryOperator',
                                 getMultiplicativeExpression);
    }

    function getMultiplicativeExpression() {
      return getPrefixExpression([['*']],
                                 'BinaryExpression',
                                 'BinaryOperator',
                                 getDividiveExpression);
    }

    function getDividiveExpression() {
      return getPrefixExpression([['/']],
                                 'BinaryExpression',
                                 'BinaryOperator',
                                 getUnaryExpression);
    }

    function getUnaryExpression() {
      return getPostfixExpression([43, 45, 33], // + - !
                                  'UnaryExpression',
                                  'UnaryOperator',
                                  getMemberExpression);
    }

    function getCallExpression(callee) {
      getWS();
      return {
        type: 'CallExpression',
        callee: callee,
        arguments: getItemList(getExpression, ')')
      };
    }

    function getAttributeExpression(idref, computed) {
      if (idref.type !== 'ParenthesisExpression' &&
          idref.type !== 'CallExpression' &&
          idref.type !== 'Identifier' &&
          idref.type !== 'ThisExpression') {
        throw error('AttributeExpression must have Identifier, This, Call or Parenthesis as left node');
      }
      var exp;
      if (computed) {
        getWS();
        exp = getExpression();
        getWS();
        if (_source.charAt(_index) !== ']') {
          throw error('Expected "]"');
        }
        ++_index;
        return {
          type: 'AttributeExpression',
          expression: idref,
          attribute: exp,
          computed: true
        };
      }
      exp = getIdentifier();
      return {
        type: 'AttributeExpression',
        expression: idref,
        attribute: exp,
        computed: false
      };
    }

    function getPropertyExpression(idref, computed) {
      var exp;
      if (computed) {
        getWS();
        exp = getExpression();
        getWS();
        if (_source.charAt(_index) !== ']') {
          throw error('Expected "]"');
        }
        ++_index;
        return {
          type: 'PropertyExpression',
          expression: idref,
          property: exp,
          computed: true
        };
      }
      exp = getIdentifier();
      return {
        type: 'PropertyExpression',
        expression: idref,
        property: exp,
        computed: false
      };
    }

    function getMemberExpression() {
      var exp = getParenthesisExpression();
      var cc;

      // 46: '.'
      // 40: '('
      // 58: ':'
      // 91: '['
      while (true) {
        cc = _source.charCodeAt(_index);
        if (cc === 46 || cc === 91) { // . or [
          ++_index;
          exp = getPropertyExpression(exp, cc === 91);
        } else if (cc === 58 && 
                   _source.charCodeAt(_index + 1) === 58) { // ::
          _index += 2;
          if (_source.charCodeAt(_index) === 91) { // [
            ++_index;
            exp = getAttributeExpression(exp, true);
          } else {
            exp = getAttributeExpression(exp, false);
          }
        } else if (cc === 40) { // (
          ++_index;
          exp = getCallExpression(exp);
        } else {
          break;
        }
      }
      return exp;
    }

    function getParenthesisExpression() {
      // 40 == (
      if (_source.charCodeAt(_index) === 40) {
        ++_index;
        getWS();
        var pexp = {
          type: 'ParenthesisExpression',
          expression: getExpression()
        };
        getWS();
        if (_source.charCodeAt(_index) !== 41) {
          throw error('Expected ")"');
        }
        ++_index;
        return pexp;
      }
      return getPrimaryExpression();
    }

    function getPrimaryExpression() {
      var pos = _index;
      var cc = _source.charCodeAt(pos);
      // number
      while (cc > 47 && cc < 58) {
        cc = _source.charCodeAt(++pos);
      }
      if (pos > _index) {
        var start = _index;
        _index = pos;
        return {
          type: 'Number',
          value: parseInt(_source.slice(start, pos), 10)
        };
      }

      switch (cc) {
        // value: '"{[
        case 39:
        case 34:
        case 123:
        case 91:
          return getValue();

        // variable: $
        case 36:
          return getVariable();

        // globals: @
        case 64:
          ++_index;
          return {
            type: 'GlobalsExpression',
              id: getIdentifier()
          };

        // this: ~
        case 126:
          ++_index;
          return {
            type: 'ThisExpression'
          };

        default:
          return getIdentifier();
      }
    }

    /* helper functions */

    function getItemList(callback, closeChar) {
      var ch;
      getWS();
      if (_source.charAt(_index) === closeChar) {
        ++_index;
        return [];
      }

      var items = [];

      while (true) {
        items.push(callback());
        getWS();
        ch = _source.charAt(_index);
        if (ch === ',') {
          ++_index;
          getWS();
        } else if (ch === closeChar) {
          ++_index;
          break;
        } else {
          throw error('Expected "," or "' + closeChar + '"');
        }
      }
      return items;
    }

    function error(message, pos) {
      if (pos === undefined) {
        pos = _index;
      }
      var start = _source.lastIndexOf('<', pos - 1);
      var lastClose = _source.lastIndexOf('>', pos - 1);
      start = lastClose > start ? lastClose + 1 : start;
      var context = _source.slice(start, pos + 10);

      var msg = message + ' at pos ' + pos + ': "' + context + '"';
      return new ParserError(msg, pos, context);
    }

    // This code is being called whenever we
    // hit ParserError.
    //
    // The strategy here is to find the closest entry opening
    // and skip forward to it.
    //
    // It may happen that the entry opening is in fact part of expression,
    // but this should just trigger another ParserError on the next char
    // and we'll have to scan for entry opening again until we're successful
    // or we run out of entry openings in the code.
    function recover() {
      var opening = _source.indexOf('<', _index);
      var junk;
      if (opening === -1) {
        junk = {
          'type': 'JunkEntry',
          'content': _source.slice(_index)
        };
        _index = _length;
        return junk;
      }
      junk = {
        'type': 'JunkEntry',
        'content': _source.slice(_index, opening)
      };
      _index = opening;
      return junk;
    }
  }

  /* ParserError class */

  Parser.Error = ParserError;

  function ParserError(message, pos, context) {
    this.name = 'ParserError';
    this.message = message;
    this.pos = pos;
    this.context = context;
  }
  ParserError.prototype = Object.create(Error.prototype);
  ParserError.prototype.constructor = ParserError;

  /* Expose the Parser constructor */

  if (typeof exports !== 'undefined') {
    exports.Parser = Parser;
  } else if (this.L20n) {
    this.L20n.Parser = Parser;
  } else {
    this.L20nParser = Parser;
  }
}).call(this);
(function(){
  'use strict';

function GlobalsManager() {
  var _entries = {};
  var _usage = [];
  var _counter = {};

  this.registerGlobal = registerGlobal;
  this.bindGet = bindGet;
  this.globals = _entries;

  for (var i in GlobalsManager._constructors) {
    registerGlobal(GlobalsManager._constructors[i]);
  }

  function registerGlobal(globalCtor) {
    var global = new globalCtor();
    _entries[global.id] = global;
    _counter[global.id] = 0; 
    global.addEventListener('change', function(id) {
      for (var i = 0; i < _usage.length; i++) {
        if (_usage[i].globals.indexOf(id) !== -1) {
          _usage[i].callback();
        }  
      }
    });
  };

  function bindGet(get) {
    var inUsage = null;
    for (var usageInc = 0; usageInc < _usage.length; usageInc++) {
      if (_usage[usageInc] && _usage[usageInc].id === get.id) {
        inUsage = _usage[usageInc];
        break;
      }
    }
    if (!inUsage) {
      if (get.globals.length != 0) {
        _usage.push(get);
        get.globals.forEach(function(id) {
          _counter[id]++;
          _entries[id].activate();
        });
      }
    } else {
      if (get.globals.length == 0) {
        delete(_usage[usageInc]);
      } else {
        var added = get.globals.filter(function(id) {
          return inUsage.globals.indexOf(id) === -1;
        });
        added.forEach(function(id) {
          _counter[id]++;
          _entries[id].activate();
        });
        var removed = inUsage.globals.filter(function(id) {
          return get.globals.indexOf(id) === -1;
        });
        removed.forEach(function(id) {
          _counter[id]--;
          if (_counter[id] == 0) {
            _entries[id].deactivate();
          }
        });
        inUsage.globals = get.globals;
      }
    }
  }
}

GlobalsManager._constructors = [];

GlobalsManager.registerGlobal = function(ctor) {
  GlobalsManager._constructors.push(ctor);
}

function Global() {
  this.id = null;
  this._emitter = new L20n.EventEmitter();
}

Global.prototype.addEventListener = function(type, listener) {
  if (type !== 'change') {
    throw "Unknown event type";
  }
  this._emitter.addEventListener(type, listener);
}

Global.prototype.activate = function() {}
Global.prototype.deactivate = function() {}

GlobalsManager.Global = Global;

L20n.GlobalsManager = GlobalsManager;



// XXX: Warning, we're cheating here for now. We want to have @screen.width,
// but since we can't get it from compiler, we call it @screen and in order to
// keep API forward-compatible with 1.0 we return an object with key width to
// make it callable as @screen.width
function ScreenGlobal() {
  Global.call(this);
  this.id = 'screen';
  this.get = get;
  this.activate = activate;
  this.isActive = false;

  var value = null;
  var self = this;

  function get() {
    if (!value) {
      value = document.body.clientWidth;
    }
    return {'width': value};
  }

  function activate() {
    if (!this.isActive) {
      window.addEventListener('resize', onchange);
      this.isActive = true;
    }
  }

  function deactivate() {
    window.removeEventListener('resize', onchange);
  }

  function onchange() {
    value = document.body.clientWidth;
    self._emitter.emit('change', self.id);
  }
}

ScreenGlobal.prototype = Object.create(Global.prototype);
ScreenGlobal.prototype.constructor = ScreenGlobal;


function OSGlobal() {
  Global.call(this);
  this.id = 'os';
  this.get = get;

  function get() {
    if (/^MacIntel/.test(navigator.platform)) {
      return 'mac';
    }
    if (/^Linux/.test(navigator.platform)) {
      return 'linux';
    }
    if (/^Win/.test(navigatgor.platform)) {
      return 'win';
    }
    return 'unknown';
  }

}

OSGlobal.prototype = Object.create(Global.prototype);
OSGlobal.prototype.constructor = OSGlobal;

function HourGlobal() {
  Global.call(this);
  this.id = 'hour';
  this.get = get;
  this.activate = activate;
  this.deactivate = deactivate;
  this.isActive = false;

  var self = this;
  var value = null;
  var interval = 60 * 60 * 1000;
  var I = null;

  function get() {
    if (!value) {
      var time = new Date();
      value = time.getHours();
    }
    return value;
  }

  function onchange() {
    var time = new Date();
    if (time.getHours() !== value) {
      value = time.getHours();
      self._emitter.emit('change', self.id);
    }
  }

  function activate() {
    if (!this.isActive) {
      var time = new Date();
      I = setTimeout(function() {
        onchange();
        I = setInterval(onchange, interval);
      }, interval - (time.getTime() % interval));
      this.isActive = true;
    }
  }

  function deactivate() {
    value = null;
    clearInterval(I);
    this.isActive = false;
  }

}

HourGlobal.prototype = Object.create(Global.prototype);
HourGlobal.prototype.constructor = HourGlobal;

GlobalsManager.registerGlobal(ScreenGlobal);
GlobalsManager.registerGlobal(OSGlobal);
GlobalsManager.registerGlobal(HourGlobal);

}).call(this);
(function() {
  'use strict';

  function EventEmitter() {
    this._listeners = {};
  }

  EventEmitter.prototype.emit = function ee_emit() {
    var args = Array.prototype.slice.call(arguments);
    var type = args.shift();
    var typeListeners = this._listeners[type];
    if (!typeListeners || !typeListeners.length) {
      return false;
    }
    typeListeners.forEach(function(listener) {
      listener.apply(this, args);
    }, this);
    return true;
  }

  EventEmitter.prototype.addEventListener = function ee_add(type, listener) {
    if (!this._listeners[type]) {
      this._listeners[type] = [];
    }
    this._listeners[type].push(listener);
    return this;
  }

  EventEmitter.prototype.removeEventListener = function ee_remove(type, listener) {
    var typeListeners = this._listeners[type];
    var pos = typeListeners.indexOf(listener);
    if (pos === -1) {
      return this;
    }
    listeners.splice(pos, 1);
    return this;
  }

  if (typeof exports !== 'undefined') {
    exports.EventEmitter = EventEmitter;
  } else if (this.L20n) {
    this.L20n.EventEmitter = EventEmitter;
  } else {
    this.L20nEventEmitter = EventEmitter;
  }
}).call(this);
// This is L20n's on-the-fly compiler.  It takes the AST produced by the parser 
// and uses it to create a set of JavaScript objects and functions representing 
// entities and macros and other expressions.
//
// The module defines a `Compiler` singleton with a single method: `compile`.
// The result of the compilation is stored on the `entries` object passed as 
// the second argument to the `compile` function.  The third argument is 
// `globals`, an object whose properties provide information about the runtime 
// environment, e.g., the current hour, operating system etc.
//
// Main concepts
// -------------
//
// **Entities** and **attributes** are objects which are publicly available.  
// Their `toString` method is designed to be used by the L20n context to get 
// a string value of the entity, given the context data passed to the method.
//
// All other symbols defined by the grammar are implemented as expression 
// functions.  The naming convention is:
//
//   - capitalized first letters denote **expressions constructors**, e.g.
//   `PropertyExpression`.
//   - camel-case denotes **expression functions** returned by the 
//   constructors, e.g. `propertyExpression`.
//
// ### Constructors
//
// The constructor is called for every node in the AST.  It stores the 
// components of the expression which are constant and do not depend on the 
// calling context (an example of the latter would be the data passed by the 
// developer to the `toString` method).
// 
// ### Expression functions
//
// The constructor, when called, returns an expression function, which, in 
// turn, is called every time the expression needs to be evaluated.  The 
// evaluation call is context-dependend.  Every expression function takes two 
// mandatory arguments and one optional one:
//
// - `locals`, which stores the information about the currently evaluated 
// entity (`locals.__this__`).  It also stores the arguments passed to macros.
// - `ctxdata`, which is an object with data passed to the context by the 
// developer.  The developer can define data on the context, or pass it on 
// a per-call basis.
// - `key` (optional), which is a number or a string passed to a `HashLiteral` 
// expression denoting the member of the hash to return.  The member will be 
// another expression function which can then be evaluated further.
//
//
// Bubbling up the new _current_ entity
// ------------------------------------
//
// Every expression function returns an array [`newLocals`, `evaluatedValue`].
// The reason for this, and in particular for returning `newLocals`, is 
// important for understanding how the compiler works.
//
// In most of the cases. `newLocals` will be the same as the original `locals` 
// passed to the expression function during the evaluation call.  In some 
// cases, however, `newLocals.__this__` will reference a different entity than 
// `locals.__this__` did.  On runtime, as the compiler traverses the AST and 
// goes deeper into individual branches, when it hits an `identifier` and 
// evaluates it to an entity, it needs to **bubble up** this find back to the 
// top expressions in the chain.  This is so that the evaluation of the 
// top-most expressions in the branch (root being at the very top of the tree) 
// takes into account the new value of `__this__`.
//
// To illustrate this point, consider the following example.
//
// Two entities, `brandName` and `about` are defined as such:
// 
//     <brandName {
//       short: "Firefox",
//       long: "Mozilla {{ ~ }}"
//     }>
//     <about "About {{ brandName.long }}">
//
// Notice two `complexString`s: `about` references `brandName.long`, and 
// `brandName.long` references its own entity via `~`.  This `~` (meaning, the 
// current entity) must always reference `brandName`, even when called from 
// `about`.
//
// The AST for the `about` entity looks like this:
//
//     [Entity]
//       .id[Identifier]
//         .name[unicode "about"]
//       .index
//       .value[ComplexString]                      <1>
//         .content
//           [String]                               <2>
//             .content[unicode "About "]
//           [PropertyExpression]                   <3>
//             .expression[Identifier]              <4>
//               .name[unicode "brandName"]
//             .property[Identifier]
//               .name[unicode "long"]
//             .computed[bool=False]
//       .attrs
//       .local[bool=False]
//
// During the compilation the compiler will walk the AST top-down to the 
// deepest terminal leaves and will use expression constructors to create 
// expression functions for the components.  For instance, for `about`'s value, 
// the compiler will call `ComplexString()` to create an expression function 
// `complexString` <1> which will be assigned to the entity's value. The 
// `ComplexString` construtor, before it returns the `complexString` <1>, will 
// in turn call other expression constructors to create `content`: 
// a `stringLiteral` and a `propertyExpression`.  The `PropertyExpression` 
// contructor will do the same, etc...
//
// When `entity.toString(ctxdata)` is called by a third-party code, we need to 
// resolve the whole `complexString` <1> to return a single string value.  This 
// is what **resolving** means and it involves some recursion.  On the other 
// hand, **evaluating** means _to call the expression once and use what it 
// returns_.
// 
// `toString` sets `locals.__this__` to the current entity, `about` and tells 
// the `complexString` <1> to _resolve_ itself.
//
// In order to resolve the `complexString` <1>, we start by resolving its first 
// member <2> to a string.  As we resolve deeper down, we bubble down `locals` 
// set by `toString`.  The first member of `content` turns out to simply be 
// a string that reads `About `.
//
// On to the second member, the propertyExpression <3>.  We bubble down 
// `locals` again and proceed to evaluate the `expression` field, which is an 
// `identifier`.  Note that we don't _resolve_ it to a string; we _evaluate_ it 
// to something that can be further used in other expressions, in this case, an 
// **entity** called `brandName`.
//
// Had we _resolved_ the `propertyExpression`, it would have resolve to 
// a string, and it would have been impossible to access the `long` member.  
// This leads us to an important concept:  the compiler _resolves_ expressions 
// when it expects a primitive value (a string, a number, a bool).  On the 
// other hand, it _evaluates_ expressions (calls them only once) when it needs 
// to work with them further, e.g. in order to access a member of the hash.
//
// This also explains why in the above example, once the compiler hits the 
// `brandName` identifier and changes the value of `locals.__this__` to the 
// `brandName` entity, this value doesn't bubble up all the way up to the 
// `about` entity.  All components of any `complexString` are _resolved_ by the 
// compiler until a primitive value is returned.  This logic lives in the 
// `_resolve` function.

//
// Inline comments
// ---------------
//
// Isolate the code by using an immediately-invoked function expression.
// Invoke it via `(function(){ ... }).call(this)` so that inside of the IIFE, 
// `this` references the global object.
(function() {
  'use strict';

  function Compiler(Emitter, Parser) {

    // Public

    this.compile = compile;
    this.setGlobals = setGlobals;
    this.addEventListener = addEventListener;
    this.removeEventListener = removeEventListener;
    this.reset = reset;

    // Private

    var _emitter = Emitter ? new Emitter() : null;
    var _parser = Parser ? new Parser() : null;
    var _env = {};
    var _globals = {};
    var _references = {
      globals: {},
    };

    // Public API functions

    function compile(ast) {
      _env = {};
      var types = {
        Entity: Entity,
        Macro: Macro,
      };
      for (var i = 0, entry; entry = ast.body[i]; i++) {
        var constructor = types[entry.type];
        if (constructor) {
          try {
            _env[entry.id.name] = new constructor(entry);
          } catch (e) {
            // rethrow non-compiler errors;
            requireCompilerError(e);
            // or, just ignore the error;  it's been already emitted
          }
        }
      }
      return _env;
    }

    function setGlobals(globals) {
      _globals = globals;
      return true;
    }

    function addEventListener(type, listener) {
      if (!_emitter) {
        throw Error("Emitter not available");
      }
      return _emitter.addEventListener(type, listener);
    }

    function removeEventListener(type, listener) {
      if (!_emitter) {
        throw Error("Emitter not available");
      }
      return _emitter.removeEventListener(type, listener);
    }

    // reset the state of a compiler instance; used in tests
    function reset() {
      _env = {};
      _globals = {};
      _references.globals = {};
      return this;
    }

    // utils

    function emit(ctor, message, entry, source) {
      var e = new ctor(message, entry, source);
      if (_emitter) {
        _emitter.emit('error', e);
      }
      return e;
    }


    // The Entity object.
    function Entity(node) {
      this.id = node.id.name;
      this.local = node.local || false;
      this.index = [];
      this.attributes = {};
      this.publicAttributes = [];
      var i;
      for (i = 0; i < node.index.length; i++) {
        this.index.push(Expression(node.index[i], this));
      }
      for (i = 0; i < node.attrs.length; i++) {
        var attr = node.attrs[i];
        this.attributes[attr.key.name] = new Attribute(attr, this);
        if (!attr.local) {
          this.publicAttributes.push(attr.key.name);
        }
      }
      this.value = Expression(node.value, this, this.index);
    }
    // Entities are wrappers around their value expression.  _Yielding_ from 
    // the entity is identical to _evaluating_ its value with the appropriate 
    // value of `locals.__this__`.  See `PropertyExpression` for an example 
    // usage.
    Entity.prototype._yield = function E_yield(ctxdata, key) {
      var locals = {
        __this__: this,
      };
      return this.value(locals, ctxdata, key);
    };
    // Calling `entity._resolve` will _resolve_ its value to a primitive value.  
    // See `ComplexString` for an example usage.
    Entity.prototype._resolve = function E_resolve(ctxdata) {
      var locals = {
        __this__: this,
      };
      return _resolve(this.value, locals, ctxdata);
    };
    Entity.prototype.getString = function E_getString(ctxdata) {
      try {
        return this._resolve(ctxdata);
      } catch (e) {
        requireCompilerError(e);
        // `ValueErrors` are not emitted in `StringLiteral` where they are 
        // created, because if the string in question is being evaluated in an 
        // index, we'll emit an `IndexError` instead.  To avoid duplication, 
        // the `ValueErrors` will only be emitted if it actually made it to 
        // here.  See `HashLiteral` for an example of why it wouldn't make it.
        if (e instanceof ValueError && _emitter) {
          _emitter.emit('error', e);
        }
        throw e;
      }
    };
    Entity.prototype.get = function E_get(ctxdata) {
      // reset `_references` to an empty state
      _references.globals = {};
      // evaluate the entity and its attributes;  if any globals are used in 
      // the process, `toString` will populate `_references.globals` 
      // accordingly.
      var entity = {
        value: this.getString(ctxdata),
        attributes: {},
      };
      for (var i = 0, attr; attr = this.publicAttributes[i]; i++) {
        entity.attributes[attr] = this.attributes[attr].getString(ctxdata);
      }
      entity.globals = _references.globals;
      return entity;
    }

    function Attribute(node, entity) {
      this.key = node.key.name;
      this.local = node.local || false;
      this.index = [];
      for (var i = 0; i < node.index.length; i++) {
        this.index.push(Expression(node.index[i], this));
      }
      this.value = Expression(node.value, entity, this.index);
      this.entity = entity;
    }
    Attribute.prototype._yield = function A_yield(ctxdata, key) {
      var locals = {
        __this__: this.entity,
      };
      return this.value(locals, ctxdata, key);
    };
    Attribute.prototype._resolve = function A_resolve(ctxdata) {
      var locals = {
        __this__: this.entity,
      };
      return _resolve(this.value, locals, ctxdata);
    };
    Attribute.prototype.getString = function A_getString(ctxdata) {
      try {
        return this._resolve(ctxdata);
      } catch (e) {
        requireCompilerError(e);
        if (e instanceof ValueError && _emitter) {
          _emitter.emit('error', e);
        }
        throw e;
      }
    };

    function Macro(node) {
      this.id = node.id.name;
      this.local = node.local || false;
      this.expression = Expression(node.expression, this);
      this.args = node.args;
    }
    Macro.prototype._call = function M_call(ctxdata, args) {
      var locals = {
        __this__: this,
      };
      for (var i = 0; i < this.args.length; i++) {
        locals[this.args[i].id.name] = args[i];
      }
      return this.expression(locals, ctxdata);
    }


    var EXPRESSION_TYPES = {
      // Primary expressions.
      'Identifier': Identifier,
      'ThisExpression': ThisExpression,
      'VariableExpression': VariableExpression,
      'GlobalsExpression': GlobalsExpression,

      // Value expressions.
      'Number': NumberLiteral,
      'String': StringLiteral,
      'Hash': HashLiteral,
      'HashItem': Expression,
      'ComplexString': ComplexString,

      // Logical expressions.
      'UnaryExpression': UnaryExpression,
      'BinaryExpression': BinaryExpression,
      'LogicalExpression': LogicalExpression,
      'ConditionalExpression': ConditionalExpression,

      // Member expressions.
      'CallExpression': CallExpression,
      'PropertyExpression': PropertyExpression,
      'AttributeExpression': AttributeExpression,
      'ParenthesisExpression': ParenthesisExpression,
    };

    // The 'dispatcher' expression constructor.  Other expression constructors 
    // call this to create expression functions for their components.  For 
    // instance, `ConditionalExpression` calls `Expression` to create expression 
    // functions for its `test`, `consequent` and `alternate` symbols.
    function Expression(node, entry, index) {
      // An entity can have no value.  It will be resolved to `null`.
      if (!node) {
        return null;
      }
      if (!EXPRESSION_TYPES[node.type]) {
        throw emit('CompilationError', 'Unknown expression type' + node.type);
      }
      if (index) {
        index = index.slice();
      }
      return EXPRESSION_TYPES[node.type](node, entry, index);
    }

    function _resolve(expr, locals, ctxdata, index) {
      // Bail out early if it's a primitive value or `null`.  This is exactly 
      // what we want.
      if (!expr || 
          typeof expr === 'string' || 
          typeof expr === 'boolean' || 
          typeof expr === 'number') {
        return expr;
      }
      // Check if `expr` knows how to resolve itself (if it's an Entity or an 
      // Attribute).
      if (expr._resolve) {
        return expr._resolve(ctxdata);
      }
      var current = expr(locals, ctxdata);
      locals = current[0], current = current[1];
      return _resolve(current, locals, ctxdata);
    }

    function Identifier(node, entry) {
      var name = node.name;
      return function identifier(locals, ctxdata) {
        if (!_env.hasOwnProperty(name)) {
          throw new RuntimeError('Reference to an unknown entry: ' + name,
                                 entry);
        }
        locals.__this__ = _env[name];
        return [locals, _env[name]];
      };
    }
    function ThisExpression(node, entry) {
      return function thisExpression(locals, ctxdata) {
        return [locals, locals.__this__];
      };
    }
    function VariableExpression(node, entry) {
      var name = node.id.name;
      return function variableExpression(locals, ctxdata) {
        if (locals.hasOwnProperty(name)) {
          return locals[name];
        }
        if (!ctxdata || !ctxdata.hasOwnProperty(name)) {
          throw new RuntimeError('Reference to an unknown variable: ' + name,
                                 entry);
        }
        return [locals, ctxdata[name]];
      };
    }
    function GlobalsExpression(node, entry) {
      var name = node.id.name;
      return function globalsExpression(locals, ctxdata) {
        if (!_globals) {
          throw new RuntimeError('Globals missing (tried @' + name + ').',
                                 entry);
        }
        if (!_globals.hasOwnProperty(name)) {
          throw new RuntimeError('Reference to an unknown global: ' + name,
                                 entry);
        }
        _references.globals[name] = true;
        return [locals, _globals[name].get()];
      };
    }
    function NumberLiteral(node, entry) {
      return function numberLiteral(locals, ctxdata) {
        return [locals, node.value];
      };
    }
    function StringLiteral(node, entry) {
      var parsed, complex;
      return function stringLiteral(locals, ctxdata) {
        if (!complex) {
          try {
            parsed = _parser.parseString(node.content);
          } catch (e) {
            throw new ValueError("Malformed string. " + e.message, entry, 
                                 node.content);
          }
          if (parsed.type == 'String') {
            return [locals, parsed.content];
          }
          complex = Expression(parsed, entry);
        }
        try {
          return [locals, _resolve(complex, locals, ctxdata)];
        } catch (e) {
          requireCompilerError(e);
          // only throw, don't emit yet.  If the `ValueError` makes it to 
          // `toString()` it will be emitted there.  It might, however, be 
          // cought by `HashLiteral` and changed into a `IndexError`.  See 
          // those Expressions for more docs.
          throw new ValueError(e.message, entry, node.content);
        }
      };
    }
    function HashLiteral(node, entry, index) {
      var content = [];
      // if absent, `defaultKey` and `defaultIndex` are undefined
      var defaultKey;
      var defaultIndex = index.length ? index.shift() : undefined;
      for (var i = 0; i < node.content.length; i++) {
        var elem = node.content[i];
        // use `elem.value` to skip `HashItem` and create the value right away
        content[elem.key.name] = Expression(elem.value, entry, index);
        if (elem.default) {
          defaultKey = elem.key.name;
        }
      }
      return function hashLiteral(locals, ctxdata, prop) {
        var keysToTry = [prop, defaultIndex, defaultKey];
        var keysTried = [];
        for (var i = 0; i < keysToTry.length; i++) {
          try {
            // only defaultIndex needs to be resolved
            var key = keysToTry[i] = _resolve(keysToTry[i], locals, ctxdata);
          } catch (e) {
            requireCompilerError(e);

            // Throw and emit an IndexError so that ValueErrors from the index 
            // don't make their way to the context.  The context only cares 
            // about ValueErrors thrown by the value of the entity it has 
            // requested, not entities used in the index.
            //
            // To illustrate this point with an example, consider the following 
            // two strings, where `foo` is a missing entity.
            //
            //     <prompt1["remove"] {
            //       remove: "Remove {{ foo }}?",
            //       keep: "Keep {{ foo }}?"
            //     }>
            //
            // `prompt1` will throw a `ValueError`.  The context can use it to 
            // display the source of the entity, i.e. `Remove {{ foo }}?`.  The 
            // index resolved properly, so at least we know that we're showing 
            // the right variant of the entity.
            //
            //     <prompt2["{{ foo }}"] {
            //       remove: "Remove file?",
            //       keep: "Keep file?"
            //     }>
            //
            // On the other hand, `prompt2` will throw an `IndexError`.  This 
            // is a more serious scenatio for the context.  We should not 
            // assume that we know which variant to show to the user.  In fact, 
            // in the above (much contrived, but still) example, showing the 
            // incorrect variant will likely lead to data loss.  The context 
            // should be more strict in this case and should not try to recover 
            // from this error too hard.
            throw emit(IndexError, e.message, entry);
          }
          if (key === undefined) {
            continue;
          }
          if (typeof key !== 'string') {
            throw emit(IndexError, 'Index must be a string', entry);
          }
          keysTried.push(key);
          if (content.hasOwnProperty(key)) {
            return [locals, content[key]];
          }
        }

        throw emit(IndexError,
                   keysTried.length ? 
                     'Hash key lookup failed (tried "' + keysTried.join('", "') + '").' :
                     'Hash key lookup failed.',
                   entry);
      };
    }
    function ComplexString(node, entry) {
      var content = [];
      for (var i = 0; i < node.content.length; i++) {
        content.push(Expression(node.content[i], entry));
      }
      // Every complexString needs to have its own `dirty` flag whose state 
      // persists across multiple calls to the given complexString.  On the other 
      // hand, `dirty` must not be shared by all complexStrings.  Hence the need 
      // to define `dirty` as a variable available in the closure.  Note that the 
      // anonymous function is a self-invoked one and it returns the closure 
      // immediately.
      return function() {
        var dirty = false;
        return function complexString(locals, ctxdata) {
          if (dirty) {
            throw new RuntimeError("Cyclic reference detected", entry);
          }
          dirty = true;
          var parts = [];
          try {
            for (var i = 0; i < content.length; i++) {
              var part = _resolve(content[i], locals, ctxdata);
              if (typeof part !== 'string' && typeof part !== 'number') {
                throw new RuntimeError('Placeables must be strings or numbers', 
                                       entry);
              }
              parts.push(part);
            }
          } finally {
            dirty = false;
          }
          return [locals, parts.join('')];
        }
      }();
    }

    function UnaryOperator(token, entry) {
      if (token == '-') return function negativeOperator(argument) {
        if (typeof argument !== 'number') {
          throw new RuntimeError('The unary - operator takes a number', entry);
        }
        return -argument;
      };
      if (token == '+') return function positiveOperator(argument) {
        if (typeof argument !== 'number') {
          throw new RuntimeError('The unary + operator takes a number', entry);
        }
        return +argument;
      };
      if (token == '!') return function notOperator(argument) {
        if (typeof argument !== 'boolean') {
          throw new RuntimeError('The ! operator takes a boolean', entry);
        }
        return !argument;
      };
      throw emit(CompilationError, "Unknown token: " + token, entry);
    }
    function BinaryOperator(token, entry) {
      if (token == '==') return function equalOperator(left, right) {
        if ((typeof left !== 'number' || typeof right !== 'number') &&
            (typeof left !== 'string' || typeof right !== 'string')) {
          throw new RuntimeError('The == operator takes two numbers or '+
                                 'two strings', entry);
        }
        return left == right;
      };
      if (token == '!=') return function notEqualOperator(left, right) {
        if ((typeof left !== 'number' || typeof right !== 'number') &&
            (typeof left !== 'string' || typeof right !== 'string')) {
          throw new RuntimeError('The != operator takes two numbers or '+
                                 'two strings', entry);
        }
        return left != right;
      };
      if (token == '<') return function lessThanOperator(left, right) {
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new RuntimeError('The < operator takes two numbers', entry);
        }
        return left < right;
      };
      if (token == '<=') return function lessThanEqualOperator(left, right) {
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new RuntimeError('The <= operator takes two numbers', entry);
        }
        return left <= right;
      };
      if (token == '>') return function greaterThanOperator(left, right) {
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new RuntimeError('The > operator takes two numbers', entry);
        }
        return left > right;
      };
      if (token == '>=') return function greaterThanEqualOperator(left, right) {
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new RuntimeError('The >= operator takes two numbers', entry);
        }
        return left >= right;
      };
      if (token == '+') return function addOperator(left, right) {
        if ((typeof left !== 'number' || typeof right !== 'number') &&
            (typeof left !== 'string' || typeof right !== 'string')) {
          throw new RuntimeError('The + operator takes two numbers or '+
                                 'two strings', entry);
        }
        return left + right;
      };
      if (token == '-') return function substractOperator(left, right) {
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new RuntimeError('The - operator takes numbers', entry);
        }
        return left - right;
      };
      if (token == '*') return function multiplyOperator(left, right) {
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new RuntimeError('The * operator takes numbers', entry);
        }
        return left * right;
      };
      if (token == '/') return function devideOperator(left, right) {
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new RuntimeError('The / operator takes two numbers', entry);
        }
        if (right == 0) {
          throw new RuntimeError('Division by zero not allowed.', entry);
        }
        return left / right;
      };
      if (token == '%') return function moduloOperator(left, right) {
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new RuntimeError('The % operator takes two numbers', entry);
        }
        return left % right;
      };
      throw emit(CompilationError, "Unknown token: " + token, entry);
    }
    function LogicalOperator(token, entry) {
      if (token == '&&') return function andOperator(left, right) {
        if (typeof left !== 'boolean' || typeof right !== 'boolean') {
          throw new RuntimeError('The && operator takes two booleans', entry);
        }
        return left && right;
      };
      if (token == '||') return function orOperator(left, right) {
        if (typeof left !== 'boolean' || typeof right !== 'boolean') {
          throw new RuntimeError('The || operator takes two booleans', entry);
        }
        return left || right;
      };
      throw emit(CompilationError, "Unknown token: " + token, entry);
    }
    function UnaryExpression(node, entry) {
      var operator = UnaryOperator(node.operator.token, entry);
      var argument = Expression(node.argument, entry);
      return function unaryExpression(locals, ctxdata) {
        return [locals, operator(_resolve(argument, locals, ctxdata))];
      };
    }
    function BinaryExpression(node, entry) {
      var left = Expression(node.left, entry);
      var operator = BinaryOperator(node.operator.token, entry);
      var right = Expression(node.right, entry);
      return function binaryExpression(locals, ctxdata) {
        return [locals, operator(
          _resolve(left, locals, ctxdata), 
          _resolve(right, locals, ctxdata)
        )];
      };
    }
    function LogicalExpression(node, entry) {
      var left = Expression(node.left, entry);
      var operator = LogicalOperator(node.operator.token, entry);
      var right = Expression(node.right, entry);
      return function logicalExpression(locals, ctxdata) {
        return [locals, operator(
          _resolve(left, locals, ctxdata), 
          _resolve(right, locals, ctxdata)
        )];
      }
    }
    function ConditionalExpression(node, entry) {
      var test = Expression(node.test, entry);
      var consequent = Expression(node.consequent, entry);
      var alternate = Expression(node.alternate, entry);
      return function conditionalExpression(locals, ctxdata) {
        var tested = _resolve(test, locals, ctxdata);
        if (typeof tested !== 'boolean') {
          throw new RuntimeError('Conditional expressions must test a boolean', 
                                 entry);
        }
        if (tested === true) {
          return consequent(locals, ctxdata);
        }
        return alternate(locals, ctxdata);
      };
    }

    function CallExpression(node, entry) {
      var callee = Expression(node.callee, entry);
      var args = [];
      for (var i = 0; i < node.arguments.length; i++) {
        args.push(Expression(node.arguments[i], entry));
      }
      return function callExpression(locals, ctxdata) {
        var evaluated_args = [];
        for (var i = 0; i < args.length; i++) {
          evaluated_args.push(args[i](locals, ctxdata));
        }
        // callee is an expression pointing to a macro, e.g. an identifier
        var macro = callee(locals, ctxdata);
        locals = macro[0], macro = macro[1];
        if (!macro._call) {
          throw new RuntimeError('Expected a macro, got a non-callable.',
                                 entry);
        }
        // rely entirely on the platform implementation to detect recursion
        return macro._call(ctxdata, evaluated_args);
      };
    }
    function PropertyExpression(node, entry) {
      var expression = Expression(node.expression, entry);
      var property = node.computed ?
        Expression(node.property, entry) :
        node.property.name;
      return function propertyExpression(locals, ctxdata) {
        var prop = _resolve(property, locals, ctxdata);
        var parent = expression(locals, ctxdata);
        locals = parent[0], parent = parent[1];
        // If `parent` is an Entity or an Attribute, evaluate its value via the 
        // `_yield` method.  This will ensure the correct value of 
        // `locals.__this__`.
        if (parent._yield) {
          return parent._yield(ctxdata, prop);
        }
        // If `parent` is an object passed by the developer to the context 
        // (i.e., `expression` was a `VariableExpression`), simply return the 
        // member of the object corresponding to `prop`.  We don't really care 
        // about `locals` here.
        if (typeof parent !== 'function') {
          if (!parent.hasOwnProperty(prop)) {
            throw new RuntimeError(prop + 
                                   ' is not defined in the context data',
                                   entry);
          }
          return [null, parent[prop]];
        }
        return parent(locals, ctxdata, prop);
      }
    }
    function AttributeExpression(node, entry) {
      // XXX looks similar to PropertyExpression, but it's actually closer to 
      // Identifier
      var expression = Expression(node.expression, entry);
      var attribute = node.computed ?
        Expression(node.attribute, entry) :
        node.attribute.name;
      return function attributeExpression(locals, ctxdata) {
        var attr = _resolve(attribute, locals, ctxdata);
        var entity = expression(locals, ctxdata);
        locals = entity[0], entity = entity[1];
        // XXX what if it's not an entity?
        return [locals, entity.attributes[attr]];
      }
    }
    function ParenthesisExpression(node, entry) {
      return Expression(node.expression, entry);
    }

  }

  Compiler.Error = CompilerError;
  Compiler.CompilationError = CompilationError;
  Compiler.RuntimeError = RuntimeError;
  Compiler.ValueError = ValueError;
  Compiler.IndexError = IndexError;


  // `CompilerError` is a general class of errors emitted by the Compiler.
  function CompilerError(message, entry) {
    this.name = 'CompilerError';
    this.message = message;
    this.entry = entry.id;
  }
  CompilerError.prototype = Object.create(Error.prototype);
  CompilerError.prototype.constructor = CompilerError;

  // `CompilationError` extends `CompilerError`.  It's a class of errors 
  // which happen during compilation of the AST.
  function CompilationError(message, entry) {
    CompilerError.call(this, message, entry);
    this.name = 'CompilationError';
  }
  CompilationError.prototype = Object.create(CompilerError.prototype);
  CompilationError.prototype.constructor = CompilationError;

  // `RuntimeError` extends `CompilerError`.  It's a class of errors which 
  // happen during the evaluation of entries, i.e. when you call 
  // `entity.toString()`.
  function RuntimeError(message, entry) {
    CompilerError.call(this, message, entry);
    this.name = 'RuntimeError';
  };
  RuntimeError.prototype = Object.create(CompilerError.prototype);
  RuntimeError.prototype.constructor = RuntimeError;;

  // `ValueError` extends `RuntimeError`.  It's a class of errors which 
  // happen during the composition of a ComplexString value.  It's easier to 
  // recover from than an `IndexError` because at least we know that we're 
  // showing the correct member of the hash.
  function ValueError(message, entry, source) {
    RuntimeError.call(this, message, entry);
    this.name = 'ValueError';
    this.source = source;
  }
  ValueError.prototype = Object.create(RuntimeError.prototype);
  ValueError.prototype.constructor = ValueError;;

  // `IndexError` extends `RuntimeError`.  It's a class of errors which 
  // happen during the lookup of a hash member.  It's harder to recover 
  // from than `ValueError` because we en dup not knowing which variant of the 
  // entity value to show and in case the meanings are divergent, the 
  // consequences for the user can be serious.
  function IndexError(message, entry) {
    RuntimeError.call(this, message, entry);
    this.name = 'IndexError';
  };
  IndexError.prototype = Object.create(RuntimeError.prototype);
  IndexError.prototype.constructor = IndexError;;

  function requireCompilerError(e) {
    if (!(e instanceof CompilerError)) {
      throw e;
    }
  }


  // Expose the Compiler constructor

  // Depending on the environment the script is run in, define `Compiler` as 
  // the exports object which can be `required` as a module, or as a member of 
  // the L20n object defined on the global object in the browser, i.e. 
  // `window`.

  if (typeof exports !== 'undefined') {
    exports.Compiler = Compiler;
  } else if (this.L20n) {
    this.L20n.Compiler = Compiler;
  } else {
    this.L20nCompiler = Compiler;
  }
}).call(this);
(function() {
  'use strict';

  var data = {
    'defaultLocale': 'en-US',
    'systemLocales': ['en-US']
  }

  /* I18n API TC39 6.2.2 */
  function isStructurallyValidLanguageTag(locale) {
    return true;
  }


  /* I18n API TC39 6.2.3 */
  function canonicalizeLanguageTag(locale) {
    return locale;
  }

  /* I18n API TC39 6.2.4 */
  function defaultLocale() {
    return data.defaultLocale;
  }

  /* I18n API TC39 9.2.1 */
  function canonicalizeLocaleList(locales) {
    if (locales === undefined) {
      return [];
    }
    
    var seen = [];
    
    if (typeof(locales) == 'string') {
      locales = new Array(locales);
    }

    var len = locales.length;
    var k = 0;

    while (k < len) {
      var Pk = k.toString();
      var kPresent = locales.hasOwnProperty(Pk);
      if (kPresent) {
        var kValue = locales[Pk];

        if (typeof(kValue) !== 'string' &&
            typeof(kValue) !== 'object') {
          throw new TypeError();
        }
        
        var tag = kValue.toString();
        if (!isStructurallyValidLanguageTag(tag)) {
          throw new RangeError();
        }
        var tag = canonicalizeLanguageTag(tag);
        if (seen.indexOf(tag) === -1) {
          seen.push(tag);
        }
      }
      k += 1;
    }
    return seen;
  }

  /* I18n API TC39 9.2.2 */
  function bestAvailableLocale(availableLocales, locale) {
    var candidate = locale;
    while (1) {
      if (availableLocales.indexOf(candidate) !== -1) {
        return candidate;
      }

      var pos = candidate.lastIndexOf('-');

      if (pos === -1) {
        return undefined;
      }

      if (pos >= 2 && candidate[pos-2] == '-') {
        pos -= 2;
      }
      candidate = candidate.substr(0, pos)
    }
  }

  /* I18n API TC39 9.2.3 */
  function lookupMatcher(availableLocales, requestedLocales) {
    var i = 0;
    var len = requestedLocales.length;
    var availableLocale = undefined;

    while (i < len && availableLocale === undefined) {
      var locale = requestedLocales[i];
      var noExtensionsLocale = locale;
      var availableLocale = bestAvailableLocale(availableLocales,
                                                noExtensionsLocale);
      i += 1;
    }
    
    var result = {};
    
    if (availableLocale !== undefined) {
      result.locale = availableLocale;
      if (locale !== noExtensionsLocale) {
        throw "NotImplemented";
      }
    } else {
      result.locale = defaultLocale();
    }
    return result;
  }

  /* I18n API TC39 9.2.4 */
  var bestFitMatcher = lookupMatcher;

  /* I18n API TC39 9.2.5 */
  function resolveLocale(availableLocales,
                         requestedLocales,
                         options,
                         relevantExtensionKeys,
                         localeData) {

    var matcher = options.localeMatcher;
    if (matcher == 'lookup') {
      var r = lookupMatcher(availableLocales, requestedLocales);
    } else {
      var r = bestFitMatcher(availableLocales, requestedLocales);
    }
    var foundLocale = r.locale;

    if (r.hasOwnProperty('extension')) {
      throw "NotImplemented";
    }

    var result = {};
    result.dataLocale = foundLocale;

    var supportedExtension = "-u";

    var i = 0;
    var len = 0;

    if (relevantExtensionKeys !== undefined) {
      len = relevantExtensionKeys.length;
    }
    
    while (i < len) {
      var key = relevantExtensionKeys[i.toString()];
      var foundLocaleData = localeData(foundLocale);
      var keyLocaleData = foundLocaleData[foundLocale];
      var value = keyLocaleData[0];
      var supportedExtensionAddition = "";
      if (extensionSubtags !== undefined) {
        throw "NotImplemented";
      }

      if (options.hasOwnProperty('key')) {
        var optionsValue = options.key;
        if (keyLocaleData.indexOf(optionsValue) !== -1) {
          if (optionsValue !== value) {
            value = optionsValue;
            supportedExtensionAddition = "";
          }
        }
        result.key = value;
        supportedExtension += supportedExtensionAddition;
        i += 1;
      }
    }

    if (supportedExtension.length > 2) {
      var preExtension = foundLocale.substr(0, extensionIndex);
      var postExtension = foundLocale.substr(extensionIndex+1);
      var foundLocale = preExtension + supportedExtension + postExtension;
    }
    result.locale = foundLocale;
    return result;
  }

  /**
   * availableLocales - The list of locales that the system offers
   *
   * returns the list of availableLocales sorted by user preferred locales
   **/
  function prioritizeLocales(availableLocales) {
    /**
     * For now we just take nav.language, but we'd prefer to get
     * a list of locales that the user can read sorted by user's preference
     **/
    var requestedLocales = [navigator.language || navigator.userLanguage];
    var options = {'localeMatcher': 'lookup'};
    var tag = resolveLocale(availableLocales,
                            requestedLocales, options);
    var pos = availableLocales.indexOf(tag.locale)

    if (pos === -1) {
      // not sure why resolveLocale can return a locale that is not available
      return availableLocales;
    }
    availableLocales.splice(pos, 1);
    availableLocales.unshift(tag.locale)
    return availableLocales;
  }

  this.L20n.Intl = {
    prioritizeLocales: prioritizeLocales
  };
}).call(this);
