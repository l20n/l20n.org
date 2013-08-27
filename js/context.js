function Context(id) {
  this.id = id;
  this.data = {};
  this.entries = {};

  this.bindResource = bindResource;
  this.restart = restart;
  this.build = build;

  this.get = get;
  this.getOrError = getOrError;
  this.getEntity = getEntity;
  this.localize = localize;

  var _parser = new L20n.Parser();
  var _compiler = new L20n.Compiler();
  var _retr = new L20n.RetranslationManager();

  var _ast = null;
  var _source = null;

  _parser.addEventListener('error', function(e) {
    $('#' + id).prepend('<div class="error"><dt>' +
      e.name + '</dt><dd><div>' + e.message + '</div></dd></div>');
  });

  _compiler.setGlobals(_retr.globals);

  function restart() {
    _source = "";
    _ast = null;
    this.data = {};
    this.entries = {};
  }

  function bindResource(source) {
    _source += source;
  }

  function build() {
    _ast = _parser.parse(_source);
    this.entries = _compiler.compile(_ast); 
    _retr.all();
  }

  function get(id, data) {
    var entry = this.entries[id];
    if (entry === undefined) {
      _emitter.emit('error', new L20n.Context.EntityError("Not found", id, null));
      return id;
    } 
    try {
      return entry.getString(getArgs.call(this, data));
    } catch(e) {
      if (e instanceof L20n.Compiler.RuntimeError) {
        _emitter.emit('error', new L20n.Context.EntityError(e.message, id, null));
        return e.source || id;
      } else {
        throw e;
      }
    }
    return entity.value; 
  }

  function getOrError(id, data) {
    var entry = this.entries[id];
    if (entry === undefined) {
      var ex = new L20n.Context.EntityError("Not found", id, null);
      _emitter.emit('error', ex);
      throw ex;
    } 
    try {
      return entry.getString(getArgs.call(this, data));
    } catch(e) {
      if (e instanceof L20n.Compiler.RuntimeError) {
        throw e;
      }
      throw e;
    }
    return entity.value; 
  }

  function getEntity(id, data) {
    var entry = this.entries[id];
    if (entry === undefined) {
      _emitter.emit('error', new L20n.Context.EntityError("Not found", id, null));
      return id;
    }
    try {
      return entry.get(getArgs.call(this, data));
    } catch(e) {
      if (e instanceof L20n.Compiler.RuntimeError) {
        _emitter.emit('error', new L20n.Context.EntityError(e.message, id, null));
        return {
          value: e.source || id,
          attributes: {},
          globals: {}
        };
      } else {
        throw e;
      }
    }
  }

  function localize(ids, callback) {
    var vals = {};
    var globalsUsed = {};
    var id;
    for (var i = 0, id; id = ids[i]; i++) {
      vals[id] = getEntity.call(this, id);
      for (var global in vals[id].globals) {
        if (vals[id].globals.hasOwnProperty(global)) {
          globalsUsed[global] = true;
        }
      }
    }
    var retobj = {
      'entities': vals,
      'retranslate': localize.bind(this, ids, callback)
    };
    if (callback) {
      _retr.bindGet({
        'id': callback,
        'callback': localize.bind(this, ids, callback),
        'globals': Object.keys(globalsUsed)});
      callback(retobj);
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
