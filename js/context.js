function Context(id) {
  this.id = id;
  this.data = {};

  this.bindResource = bindResource;

  this.get = get;
  this.getEntity = getEntity;
  this.localize = localize;

  var _emitter = new L20n.EventEmitter();
  var _parser = new L20n.Parser(L20n.EventEmitter);
  var _compiler = new L20n.Compiler(L20n.EventEmitter, L20n.Parser);
  var _globalsManager = new L20n.GlobalsManager();

  var _ast = null;
  var _source = null;
  var _entries = null;

  _compiler.setGlobals(_globalsManager.globals);

  function bindResource(source) {
    _source = source;
    build();
  }

  function build() {
    _ast = _parser.parse(_source);
    _entries = _compiler.compile(_ast); 
  }

  function get(id, data) {
    var entry = _entries[id];
    if (entry === undefined) {
      _emitter.emit('error', new EntityError("Not found", id, null));
      return id;
    } 
    try {
      return entry.getString(getArgs.bind(this, data));
    } catch(e) {
      if (e instanceof L20n.Compiler.RuntimeError) {
        _emitter.emit('error', new EntityError(e.message, id, null));
        return e.source;
      } else {
        throw e;
      }
    }
    return entity.value; 
  }

  function getEntity(id, data) {
    var entry = _entries[id];
    if (entry === undefined) {
      _emitter.emit('error', new EntityError("Not found", id, null));
      return id;
    }
    return entry.get(getArgs.bind(this, data));
  }

  function localize(idsOrTuples, callback) {
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
      'entities': vals,
      'retranslate': localize.bind(this, idsOrTuples, callback)
    };
    if (callback) {
      callback(retobj);
      _globalsManager.bindGet({
        'id': callback,
        'callback': localize.bind(this, idsOrTuples, callback),
        'globals': Object.keys(globalsUsed)});
    }
    return retobj;
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
