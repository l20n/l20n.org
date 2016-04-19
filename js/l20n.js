var L20n = (function () {
  'use strict';

  function L10nError(message, id, lang) {
    this.name = 'L10nError';
    this.message = message;
    this.id = id;
    this.lang = lang;
  }
  L10nError.prototype = Object.create(Error.prototype);
  L10nError.prototype.constructor = L10nError;

  class ParseContext {
    constructor(string) {
      this._source = string;
      this._index = 0;
      this._length = string.length;

      this._lastGoodEntryEnd = 0;
      this._section = null;
    }

    getResource() {
      const entries = {};
      let errors = [];

      this.getWS();
      while (this._index < this._length) {
        try {
          let entry = this.getEntry();
          if (!entry) {
            this.getWS();
            continue;
          }

          let id = entry.id.name;

          if (entry.id.namespace) {
            id = `${entry.id.namespace}/${id}`;
          } else if (this._section !== null) {
            id = `${this._section.name}/${id}`;
          }
          entries[id] = {};

          if (entry.traits !== null &&
             entry.traits.length !== 0) {
            entries[id].traits = entry.traits;
            if (entry.value) {
              entries[id].val = entry.value;
            }
          } else {
            entries[id] = entry.value;
          }
          this._lastGoodEntryEnd = this._index;
        } catch (e) {
          if (e instanceof L10nError) {
            errors.push(e);
            this.getJunkEntry();
          } else {
            throw e;
          }
        }
        this.getWS();
      }

      return {
        entries,
        _errors: errors
      };
    }

    getEntry() {
      if (this._index !== 0 &&
          this._source[this._index - 1] !== '\n') {
        throw this.error('Expected new line and a new entry');
      }

      if (this._source[this._index] === '#') {
        this.getComment();
        return;
      }

      if (this._source[this._index] === '[') {
        this.getSection();
        return;
      }

      if (this._index < this._length &&
          this._source[this._index] !== '\n') {
        return this.getEntity();
      }
    }

    getSection(comment = null) {
      this._index += 1;
      if (this._source[this._index] !== '[') {
        throw this.error('Expected "[[" to open a section');
      }

      this._index += 1;

      this.getLineWS();

      const id = this.getIdentifier();

      this.getLineWS();

      if (this._source[this._index] !== ']' ||
          this._source[this._index + 1] !== ']') {
        throw this.error('Expected "]]" to close a section');
      }

      this._index += 2;

      this._section = id;

      return {
        type: 'section',
        id,
      };
    }

    getEntity(comment = null) {
      let id = this.getIdentifier('/');

      let members = [];
      let value = null;

      this.getLineWS();

      let ch = this._source[this._index];

      if (ch !== '=') {
        throw this.error('Expected "=" after Entity ID');
      }
      ch = this._source[++this._index];

      this.getLineWS();

      value = this.getPattern();

      ch = this._source[this._index];

      if (ch === '\n') {
        this._index++;
        this.getLineWS();
        ch = this._source[this._index];
      }

      if ((ch === '[' && this._source[this._index + 1] !== '[') ||
          ch === '*') {
        members = this.getMembers();
      } else if (value === null) {
        throw this.error(
    `Expected a value (like: " = value") or a trait (like: "[key] value")`);
      }

      return {
        id,
        value,
        traits: members
      };
    }

    getWS() {
      let cc = this._source.charCodeAt(this._index);
      // space, \n, \t, \r
      while (cc === 32 || cc === 10 || cc === 9 || cc === 13) {
        cc = this._source.charCodeAt(++this._index);
      }
    }

    getLineWS() {
      let cc = this._source.charCodeAt(this._index);
      // space, \t
      while (cc === 32 || cc === 9) {
        cc = this._source.charCodeAt(++this._index);
      }
    }

    getIdentifier(nsSep=null) {
      let namespace = null;
      let id = '';

      if (nsSep) {
        namespace = this.getIdentifier().name;
        if (this._source[this._index] === nsSep) {
          this._index++;
        } else if (namespace) {
          id = namespace;
          namespace = null; 
        }
      }

      const start = this._index;
      let cc = this._source.charCodeAt(this._index);

      if ((cc >= 97 && cc <= 122) || // a-z
          (cc >= 65 && cc <= 90) ||  // A-Z
          cc === 95) {               // _
        cc = this._source.charCodeAt(++this._index);
      } else if (id.length === 0) {
        throw this.error('Expected an identifier (starting with [a-zA-Z_])');
      }

      while ((cc >= 97 && cc <= 122) || // a-z
             (cc >= 65 && cc <= 90) ||  // A-Z
             (cc >= 48 && cc <= 57) ||  // 0-9
             cc === 95 || cc === 45) {  // _-
        cc = this._source.charCodeAt(++this._index);
      }

      id += this._source.slice(start, this._index);

      return {
        namespace,
        name: id
      };
    }

    getIdentifierWithSpace(nsSep=null) {
      let namespace = null;
      let id = '';

      if (nsSep) {
        namespace = this.getIdentifier().name;
        if (this._source[this._index] === nsSep) {
          this._index++;
        } else if (namespace) {
          id = namespace;
          namespace = null;
        }
      }

      const start = this._index;
      let cc = this._source.charCodeAt(this._index);

      if ((cc >= 97 && cc <= 122) || // a-z
          (cc >= 65 && cc <= 90) ||  // A-Z
          cc === 95 || cc === 32) {  //  _
        cc = this._source.charCodeAt(++this._index);
      } else if (id.length === 0) {
        throw this.error('Expected an identifier (starting with [a-zA-Z_])');
      }

      while ((cc >= 97 && cc <= 122) || // a-z
             (cc >= 65 && cc <= 90) ||  // A-Z
             (cc >= 48 && cc <= 57) ||  // 0-9
             cc === 95 || cc === 45 || cc === 32) {  //  _-
        cc = this._source.charCodeAt(++this._index);
      }

      id += this._source.slice(start, this._index);

      return {
        namespace,
        name: id
      };
    }

    getPattern() {
      let buffer = '';
      let source = '';
      let content = [];
      let quoteDelimited = null;
      let firstLine = true;

      let ch = this._source[this._index];


      if (ch === '\\' &&
        (this._source[this._index + 1] === '"' ||
         this._source[this._index + 1] === '{' ||
         this._source[this._index + 1] === '\\')) {
        buffer += this._source[this._index + 1];
        this._index += 2;
        ch = this._source[this._index];
      } else if (ch === '"') {
        quoteDelimited = true;
        this._index++;
        ch = this._source[this._index];
      }

      while (this._index < this._length) {
        if (ch === '\n') {
          if (quoteDelimited) {
            throw this.error('Unclosed string');
          }
          this._index++;
          this.getLineWS();
          if (this._source[this._index] !== '|') {
            break;
          }
          if (firstLine && buffer.length) {
            throw this.error('Multiline string should have the ID line empty');
          }
          firstLine = false;
          this._index++;
          if (this._source[this._index] === ' ') {
            this._index++;
          }
          if (buffer.length) {
            buffer += '\n';
          }
          ch = this._source[this._index];
          continue;
        } else if (ch === '\\') {
          let ch2 = this._source[this._index + 1];
          if ((quoteDelimited && ch2 === '"') ||
              ch2 === '{') {
            ch = ch2;
            this._index++;
          }
        } else if (quoteDelimited && ch === '"') {
          this._index++;
          quoteDelimited = false;
          break;
        } else if (ch === '{') {
          if (buffer.length) {
            content.push(buffer);
          }
          source += buffer;
          buffer = ''
          let start = this._index;
          content.push(this.getPlaceable());
          source += this._source.substring(start, this._index);
          ch = this._source[this._index];
          continue;
        }

        if (ch) {
          buffer += ch;
        }
        this._index++;
        ch = this._source[this._index];
      }

      if (quoteDelimited) {
        throw this.error('Unclosed string');
      }

      if (buffer.length) {
        source += buffer;
        content.push(buffer);
      }

      if (content.length === 0) {
        if (quoteDelimited !== null) {
          content.push(source);
        } else {
          return null;
        }
      }

      if (content.length === 1 &&
          typeof content[0] === 'string') {
        return source;
      }

      return content;
    }

    getPlaceable() {
      this._index++;

      let expressions = [];

      this.getLineWS();

      while (this._index < this._length) {
        let start = this._index;
        try {
          expressions.push(this.getPlaceableExpression());
        } catch (e) {
          throw this.error(e.description, start);
        }
        this.getWS();
        if (this._source[this._index] === '}') {
          this._index++;
          break;
        } else if (this._source[this._index] === ',') {
          this._index++;
          this.getWS();
        } else {
          throw this.error('Expected "}" or ","');
        }
      }

      return expressions;
    }

    getPlaceableExpression() {
      let selector = this.getCallExpression();
      let members = null;

      this.getWS();

      if (this._source[this._index] !== '}' &&
          this._source[this._index] !== ',') {
        if (this._source[this._index] !== '-' ||
            this._source[this._index + 1] !== '>') {
          throw this.error('Expected "}", "," or "->"');
        }
        this._index += 2; // ->

        this.getLineWS();

        if (this._source[this._index] !== '\n') {
          throw this.error('Members should be listed in a new line');
        }

        this.getWS();

        members = this.getMembers();

        if (members.length === 0) {
          throw this.error('Expected members for the select expression');
        }
      }

      if (members === null) {
        return selector;
      }
      return {
        type: 'sel',
        exp: selector,
        vars: members
      };
    }

    getCallExpression() {
      let exp = this.getMemberExpression();

      if (this._source[this._index] !== '(') {
        return exp;
      }

      this._index++;

      let args = this.getCallArgs();

      this._index++;

      if (exp.type = 'ref') {
        exp.type = 'blt';
      }

      return {
        type: 'call',
        name: exp,
        args
      };
    }

    getCallArgs() {
      let args = [];

      if (this._source[this._index] === ')') {
        return args;
      }

      while (this._index < this._length) {
        this.getLineWS();

        let exp = this.getCallExpression();

        if (exp.type !== 'ref' ||
           exp.namespace !== undefined) {
          args.push(exp);
        } else {
          this.getLineWS();

          if (this._source[this._index] === ':') {
            this._index++;
            this.getLineWS();

            let val = this.getCallExpression();

            if (val.type === 'ref' ||
                val.type === 'member') {
              this._index = this._source.lastIndexOf('=', this._index) + 1;
              throw this.error('Expected string in quotes');
            }

            args.push({
              type: 'kv',
              name: exp.name,
              val
            });
          } else {
            args.push(exp);
          }
        }

        this.getLineWS();

        if (this._source[this._index] === ')') {
          break;
        } else if (this._source[this._index] === ',') {
          this._index++;
        } else {
          throw this.error('Expected "," or ")"');
        }
      }

      return args;
    }

    getNumber() {
      let num = '';
      let cc = this._source.charCodeAt(this._index);

      if (cc === 45) {
        num += '-';
        cc = this._source.charCodeAt(++this._index);
      }

      if (cc < 48 || cc > 57) {
        throw this.error(`Unknown literal "${num}"`);
      }

      while (cc >= 48 && cc <= 57) {
        num += this._source[this._index++];
        cc = this._source.charCodeAt(this._index);
      }

      if (cc === 46) {
        num += this._source[this._index++];
        cc = this._source.charCodeAt(this._index);

        if (cc < 48 || cc > 57) {
          throw this.error(`Unknown literal "${num}"`);
        }

        while (cc >= 48 && cc <= 57) {
          num += this._source[this._index++];
          cc = this._source.charCodeAt(this._index);
        }
      }

      return {
        type: 'num',
        val: num
      };
    }

    getMemberExpression() {
      let exp = this.getLiteral();

      while (this._source[this._index] === '[') {
        let keyword = this.getKeyword();
        exp = {
          type: 'mem',
          key: keyword,
          obj: exp
        };
      }

      return exp;
    }

    getMembers() {
      const members = [];

      while (this._index < this._length) {
        if ((this._source[this._index] !== '[' ||
             this._source[this._index + 1] === '[') &&
            this._source[this._index] !== '*') {
          break;
        }
        let def = false;
        if (this._source[this._index] === '*') { 
          this._index++;
          def = true;
        }

        if (this._source[this._index] !== '[') {
          throw this.error('Expected "["');
        }

        let key = this.getKeyword();

        this.getLineWS();

        let value = this.getPattern();

        let member = {
          key,
          val: value
        };
        if (def) {
          member.def = true;
        }
        members.push(member);

        this.getWS();
      }

      return members;
    }

    getKeyword() {
      this._index++;

      let cc = this._source.charCodeAt(this._index);
      let literal;

      if ((cc >= 48 && cc <= 57) || cc === 45) {
        literal = this.getNumber();
      } else {
        let id = this.getIdentifierWithSpace('/');
        literal = {
          type: 'id',
          name: id.name
        };
        if (id.namespace) {
          literal.ns = id.namespace;
        }
      }

      if (this._source[this._index] !== ']') {
        throw this.error('Expected "]"');
      }

      this._index++;
      return literal;
    }

    getLiteral() {
      let cc = this._source.charCodeAt(this._index);
      if ((cc >= 48 && cc <= 57) || cc === 45) {
        return this.getNumber();
      } else if (cc === 34) { // "
        return this.getPattern();
      } else if (cc === 36) { // $
        this._index++;
        let id = this.getIdentifier();
        return {
          type: 'ext',
          name: id.name
        };
      }

      let id = this.getIdentifier('/');
      
      let name = id.name;
      if (id.namespace) {
        name = `${id.namespace}/${name}`;
      }
      let ent = {
        type: 'ref',
        name: name
      };
      return ent;
    }

    getComment() {
      this._index++;
      if (this._source[this._index] === ' ') {
        this._index++;
      }

      let content = '';

      let eol = this._source.indexOf('\n', this._index);

      content += this._source.substring(this._index, eol);

      while (eol !== -1 && this._source[eol + 1] === '#') {
        this._index = eol + 2;

        if (this._source[this._index] === ' ') {
          this._index++;
        }

        eol = this._source.indexOf('\n', this._index);

        if (eol === -1) {
          break;
        }

        content += '\n' + this._source.substring(this._index, eol);
      }

      if (eol === -1) {
        this._index = this._length;
      } else {
        this._index = eol + 1;
      }

      return content;
    }

    error(message, start=null) {
      let colors = require('colors/safe');

      const pos = this._index;

      if (start === null) {
        start = pos;
      }
      start = this._findEntityStart(start);

      let context = this._source.slice(start, pos + 10);

      const msg = '\n\n  ' + message +
        '\nat pos ' + pos + ':\n------\n…' + context + '\n------';
      const err = new L10nError(msg);

      let row = this._source.slice(0, pos).split('\n').length;
      let col = pos - this._source.lastIndexOf('\n', pos - 1);
      err._pos = {start: pos, end: undefined, col: col, row: row};
      err.offset = pos - start;
      err.description = message;
      err.context = context;
      return err;
    }

    getJunkEntry() {
      const pos = this._index;

      let nextEntity = this._findNextEntryStart(pos);

      if (nextEntity === -1) {
        nextEntity = this._length;
      }

      this._index = nextEntity;

      let entityStart = this._findEntityStart(pos);

      if (entityStart < this._lastGoodEntryEnd) {
        entityStart = this._lastGoodEntryEnd;
      }
    }

    _findEntityStart(pos) {
      let start = pos;

      while (true) {
        start = this._source.lastIndexOf('\n', start - 2);
        if (start === -1 || start === 0) {
          start = 0;
          break;
        }
        let cc = this._source.charCodeAt(start + 1);

        if ((cc >= 97 && cc <= 122) || // a-z
            (cc >= 65 && cc <= 90) ||  // A-Z
             cc === 95) {              // _
          start++;
          break;
        }
      }

      return start;
    }

    _findNextEntryStart(pos) {
      let start = pos;

      while (true) {
        if (start === 0 ||
            this._source[start - 1] === '\n') {
          let cc = this._source.charCodeAt(start);

          if ((cc >= 97 && cc <= 122) || // a-z
              (cc >= 65 && cc <= 90) ||  // A-Z
               cc === 95 || cc === 35 || cc === 91) {  // _#[
            break;
          }
        }

        start = this._source.indexOf('\n', start);

        if (start === -1) {
          break;
        }
        start++;
      }

      return start;
    }
  }

  var FTLEntriesParser = {
    parseResource: function(string) {
      const parseContext = new ParseContext(string);
      return parseContext.getResource();
    },
  };

  /*eslint no-magic-numbers: [0]*/

  const locales2rules = {
    'af': 3,
    'ak': 4,
    'am': 4,
    'ar': 1,
    'asa': 3,
    'az': 0,
    'be': 11,
    'bem': 3,
    'bez': 3,
    'bg': 3,
    'bh': 4,
    'bm': 0,
    'bn': 3,
    'bo': 0,
    'br': 20,
    'brx': 3,
    'bs': 11,
    'ca': 3,
    'cgg': 3,
    'chr': 3,
    'cs': 12,
    'cy': 17,
    'da': 3,
    'de': 3,
    'dv': 3,
    'dz': 0,
    'ee': 3,
    'el': 3,
    'en': 3,
    'eo': 3,
    'es': 3,
    'et': 3,
    'eu': 3,
    'fa': 0,
    'ff': 5,
    'fi': 3,
    'fil': 4,
    'fo': 3,
    'fr': 5,
    'fur': 3,
    'fy': 3,
    'ga': 8,
    'gd': 24,
    'gl': 3,
    'gsw': 3,
    'gu': 3,
    'guw': 4,
    'gv': 23,
    'ha': 3,
    'haw': 3,
    'he': 2,
    'hi': 4,
    'hr': 11,
    'hu': 0,
    'id': 0,
    'ig': 0,
    'ii': 0,
    'is': 3,
    'it': 3,
    'iu': 7,
    'ja': 0,
    'jmc': 3,
    'jv': 0,
    'ka': 0,
    'kab': 5,
    'kaj': 3,
    'kcg': 3,
    'kde': 0,
    'kea': 0,
    'kk': 3,
    'kl': 3,
    'km': 0,
    'kn': 0,
    'ko': 0,
    'ksb': 3,
    'ksh': 21,
    'ku': 3,
    'kw': 7,
    'lag': 18,
    'lb': 3,
    'lg': 3,
    'ln': 4,
    'lo': 0,
    'lt': 10,
    'lv': 6,
    'mas': 3,
    'mg': 4,
    'mk': 16,
    'ml': 3,
    'mn': 3,
    'mo': 9,
    'mr': 3,
    'ms': 0,
    'mt': 15,
    'my': 0,
    'nah': 3,
    'naq': 7,
    'nb': 3,
    'nd': 3,
    'ne': 3,
    'nl': 3,
    'nn': 3,
    'no': 3,
    'nr': 3,
    'nso': 4,
    'ny': 3,
    'nyn': 3,
    'om': 3,
    'or': 3,
    'pa': 3,
    'pap': 3,
    'pl': 13,
    'ps': 3,
    'pt': 3,
    'rm': 3,
    'ro': 9,
    'rof': 3,
    'ru': 11,
    'rwk': 3,
    'sah': 0,
    'saq': 3,
    'se': 7,
    'seh': 3,
    'ses': 0,
    'sg': 0,
    'sh': 11,
    'shi': 19,
    'sk': 12,
    'sl': 14,
    'sma': 7,
    'smi': 7,
    'smj': 7,
    'smn': 7,
    'sms': 7,
    'sn': 3,
    'so': 3,
    'sq': 3,
    'sr': 11,
    'ss': 3,
    'ssy': 3,
    'st': 3,
    'sv': 3,
    'sw': 3,
    'syr': 3,
    'ta': 3,
    'te': 3,
    'teo': 3,
    'th': 0,
    'ti': 4,
    'tig': 3,
    'tk': 3,
    'tl': 4,
    'tn': 3,
    'to': 0,
    'tr': 0,
    'ts': 3,
    'tzm': 22,
    'uk': 11,
    'ur': 3,
    've': 3,
    'vi': 0,
    'vun': 3,
    'wa': 4,
    'wae': 3,
    'wo': 0,
    'xh': 3,
    'xog': 3,
    'yo': 0,
    'zh': 0,
    'zu': 3
  };

  // utility functions for plural rules methods
  function isIn(n, list) {
    return list.indexOf(n) !== -1;
  }
  function isBetween(n, start, end) {
    return typeof n === typeof start && start <= n && n <= end;
  }

  // list of all plural rules methods:
  // map an integer to the plural form name to use
  const pluralRules = {
    '0': function() {
      return 'other';
    },
    '1': function(n) {
      if ((isBetween((n % 100), 3, 10))) {
        return 'few';
      }
      if (n === 0) {
        return 'zero';
      }
      if ((isBetween((n % 100), 11, 99))) {
        return 'many';
      }
      if (n === 2) {
        return 'two';
      }
      if (n === 1) {
        return 'one';
      }
      return 'other';
    },
    '2': function(n) {
      if (n !== 0 && (n % 10) === 0) {
        return 'many';
      }
      if (n === 2) {
        return 'two';
      }
      if (n === 1) {
        return 'one';
      }
      return 'other';
    },
    '3': function(n) {
      if (n === 1) {
        return 'one';
      }
      return 'other';
    },
    '4': function(n) {
      if ((isBetween(n, 0, 1))) {
        return 'one';
      }
      return 'other';
    },
    '5': function(n) {
      if ((isBetween(n, 0, 2)) && n !== 2) {
        return 'one';
      }
      return 'other';
    },
    '6': function(n) {
      if (n === 0) {
        return 'zero';
      }
      if ((n % 10) === 1 && (n % 100) !== 11) {
        return 'one';
      }
      return 'other';
    },
    '7': function(n) {
      if (n === 2) {
        return 'two';
      }
      if (n === 1) {
        return 'one';
      }
      return 'other';
    },
    '8': function(n) {
      if ((isBetween(n, 3, 6))) {
        return 'few';
      }
      if ((isBetween(n, 7, 10))) {
        return 'many';
      }
      if (n === 2) {
        return 'two';
      }
      if (n === 1) {
        return 'one';
      }
      return 'other';
    },
    '9': function(n) {
      if (n === 0 || n !== 1 && (isBetween((n % 100), 1, 19))) {
        return 'few';
      }
      if (n === 1) {
        return 'one';
      }
      return 'other';
    },
    '10': function(n) {
      if ((isBetween((n % 10), 2, 9)) && !(isBetween((n % 100), 11, 19))) {
        return 'few';
      }
      if ((n % 10) === 1 && !(isBetween((n % 100), 11, 19))) {
        return 'one';
      }
      return 'other';
    },
    '11': function(n) {
      if ((isBetween((n % 10), 2, 4)) && !(isBetween((n % 100), 12, 14))) {
        return 'few';
      }
      if ((n % 10) === 0 ||
          (isBetween((n % 10), 5, 9)) ||
          (isBetween((n % 100), 11, 14))) {
        return 'many';
      }
      if ((n % 10) === 1 && (n % 100) !== 11) {
        return 'one';
      }
      return 'other';
    },
    '12': function(n) {
      if ((isBetween(n, 2, 4))) {
        return 'few';
      }
      if (n === 1) {
        return 'one';
      }
      return 'other';
    },
    '13': function(n) {
      if ((isBetween((n % 10), 2, 4)) && !(isBetween((n % 100), 12, 14))) {
        return 'few';
      }
      if (n !== 1 && (isBetween((n % 10), 0, 1)) ||
          (isBetween((n % 10), 5, 9)) ||
          (isBetween((n % 100), 12, 14))) {
        return 'many';
      }
      if (n === 1) {
        return 'one';
      }
      return 'other';
    },
    '14': function(n) {
      if ((isBetween((n % 100), 3, 4))) {
        return 'few';
      }
      if ((n % 100) === 2) {
        return 'two';
      }
      if ((n % 100) === 1) {
        return 'one';
      }
      return 'other';
    },
    '15': function(n) {
      if (n === 0 || (isBetween((n % 100), 2, 10))) {
        return 'few';
      }
      if ((isBetween((n % 100), 11, 19))) {
        return 'many';
      }
      if (n === 1) {
        return 'one';
      }
      return 'other';
    },
    '16': function(n) {
      if ((n % 10) === 1 && n !== 11) {
        return 'one';
      }
      return 'other';
    },
    '17': function(n) {
      if (n === 3) {
        return 'few';
      }
      if (n === 0) {
        return 'zero';
      }
      if (n === 6) {
        return 'many';
      }
      if (n === 2) {
        return 'two';
      }
      if (n === 1) {
        return 'one';
      }
      return 'other';
    },
    '18': function(n) {
      if (n === 0) {
        return 'zero';
      }
      if ((isBetween(n, 0, 2)) && n !== 0 && n !== 2) {
        return 'one';
      }
      return 'other';
    },
    '19': function(n) {
      if ((isBetween(n, 2, 10))) {
        return 'few';
      }
      if ((isBetween(n, 0, 1))) {
        return 'one';
      }
      return 'other';
    },
    '20': function(n) {
      if ((isBetween((n % 10), 3, 4) || ((n % 10) === 9)) && !(
          isBetween((n % 100), 10, 19) ||
          isBetween((n % 100), 70, 79) ||
          isBetween((n % 100), 90, 99)
          )) {
        return 'few';
      }
      if ((n % 1000000) === 0 && n !== 0) {
        return 'many';
      }
      if ((n % 10) === 2 && !isIn((n % 100), [12, 72, 92])) {
        return 'two';
      }
      if ((n % 10) === 1 && !isIn((n % 100), [11, 71, 91])) {
        return 'one';
      }
      return 'other';
    },
    '21': function(n) {
      if (n === 0) {
        return 'zero';
      }
      if (n === 1) {
        return 'one';
      }
      return 'other';
    },
    '22': function(n) {
      if ((isBetween(n, 0, 1)) || (isBetween(n, 11, 99))) {
        return 'one';
      }
      return 'other';
    },
    '23': function(n) {
      if ((isBetween((n % 10), 1, 2)) || (n % 20) === 0) {
        return 'one';
      }
      return 'other';
    },
    '24': function(n) {
      if ((isBetween(n, 3, 10) || isBetween(n, 13, 19))) {
        return 'few';
      }
      if (isIn(n, [2, 12])) {
        return 'two';
      }
      if (isIn(n, [1, 11])) {
        return 'one';
      }
      return 'other';
    }
  };

  function getPluralRule(code) {
    // return a function that gives the plural form name for a given integer
    const index = locales2rules[code.replace(/-.*$/, '')];
    if (!(index in pluralRules)) {
      return n => 'other';
    }
    return pluralRules[index];
  }

  // Safari 9 and iOS 9 do not support Intl at all
  const L20nIntl = typeof Intl !== 'undefined' ? Intl : {};

  if (!L20nIntl.NumberFormat) {
    L20nIntl.NumberFormat = function() {
      return {
        format(n) {
          return n;
        }
      };
    }
  }

  if (!L20nIntl.PluralRules) {
    L20nIntl.PluralRules = function(code) {
      const fn = getPluralRule(code);
      return {
        select(n) {
          return fn(n);
        }
      };
    }
  }

  if (!L20nIntl.ListFormat) {
    L20nIntl.ListFormat = function() {
      return {
        format(list) {
          return list.join(', ');
        }
      };
    }
  }

  class FTLNone {
    format() {
      return this.value || '???';
    }
    match() {
      return false;
    }
  };

  class FTLText extends FTLNone {
    constructor(value) {
      super();
      this.value = value;
    }
    format() {
      return this.value.toString();
    }
    match(res, {value}) {
      return this.value === value;
    }
  };

  class FTLNumber extends FTLText {
    constructor(value, opts) {
      super(parseFloat(value));
      this.opts = opts;
    }
    format(res) {
      const nf = res.ctx._memoizeIntlObject(
        L20nIntl.NumberFormat, res.lang, this.opts
      );
      return nf.format(this.value);
    }
    match(res, {value}) {
      switch (typeof value) {
        case 'number': return this.value === value;
        case 'string':
          const pr = res.ctx._memoizeIntlObject(
            L20nIntl.PluralRules, res.lang, this.opts
          );
          return pr.select(this.value) === value;
      }
    }
  }

  class FTLCategory extends FTLNumber {
    format(res) {
      const pr = res.ctx._memoizeIntlObject(
        L20nIntl.PluralRules, res.lang
      );
      return pr.select(this.value);
    }
    match(res, {value}) {
      switch (typeof value) {
        case 'number': return this.value === value;
        case 'string': return this.format(res) === value;
      }
    }
  }

  class FTLKeyword extends FTLText {
    constructor(value, namespace) {
      super(value);
      this.namespace = namespace;
    }
    format() {
      return this.namespace ?
        `${this.namespace}:${this.value}` :
        this.value;
    }
    match(res, {namespace, value}) {
      return this.namespace === namespace && this.value === value;
    }
  };

  class FTLKeyValueArg extends FTLText {
    constructor(value, id) {
      super(value);
      this.id = id;
    }
  };

  class FTLList extends FTLText {
    format(res) {
      const lf = res.ctx._memoizeIntlObject(
        L20nIntl.ListFormat, res.lang, this.opts
      );
      const elems = this.value.map(
        elem => elem.format(res)
      );
      return lf.format(elems);
    }
    match() {
      return false;
    }
  };

  var builtins = {
    'NUMBER': ([num], opts) => new FTLNumber(num.value, values(opts)),
    'PLURAL': ([num], opts) => new FTLCategory(num.value, values(opts)),
    'LIST': (...args) => new FTLList(...args),
  };

  function values(opts) {
    return Object.keys(opts).reduce(
      (seq, cur) => Object.assign({}, seq, {
        [cur]: opts[cur].value
      }), {});
  }

  // Unicode bidi isolation characters
  const FSI = '\u2068';
  const PDI = '\u2069';

  function mapValues(res, arr) {
    return arr.reduce(
      ([errSeq, valSeq], cur) => {
        const [errs, value] = Value(res, cur);
        return [
          [...errSeq, ...errs],
          new FTLList([...valSeq.value, value]),
        ];
      },
      [[], new FTLList([])]
    );
  }

    // XXX add this back later
    // if (value.length >= MAX_PLACEABLE_LENGTH) {
    //   throw new L10nError(
    //     'Too many characters in placeable (' + value.length +
    //       ', max allowed is ' + MAX_PLACEABLE_LENGTH + ')'
    //   );
    // }

  function unit(val) {
    return [[], val];
  }

  function fail(prevErrs, [errs, value]) {
    return [
      [...prevErrs, ...errs], value
    ];
  }


  // Helper for choosing entity value

  function DefaultMember(members) {
    for (let member of members) {
      if (member.def) {
        return unit(member);
      }
    }

    return fail(
      [new L10nError('No default')],
      unit(new FTLNone())
    );
  }


  // Half-resolved expressions

  function Expression(res, expr) {
    switch (expr.type) {
      case 'ref':
        return EntityReference(res, expr);
      case 'blt':
        return BuiltinReference(res, expr);
      case 'mem':
        return MemberExpression(res, expr);
      case 'sel':
        return SelectExpression(res, expr);
      default:
        return unit(expr);
    }
  }

  function EntityReference(res, expr) {
    const entity = res.ctx._getEntity(res.lang, expr.name);

    if (!entity) {
      return fail(
        [new L10nError('Unknown entity: ' + expr.name)],
        unit(new FTLText(expr.name))
      );
    }

    return unit(entity);
  }

  function BuiltinReference(res, expr) {
    const builtin = builtins[expr.name];

    if (!builtin) {
      return fail(
        [new L10nError('Unknown built-in: ' + expr.name + '()')],
        unit(new FTLText(expr.name + '()'))
      );
    }

    return unit(builtin);
  }

  function MemberExpression(res, expr) {
    const [errs1, entity] = Expression(res, expr.obj);
    if (errs1.length) {
      return fail(errs1, Value(res, entity));
    }

    const [, key] = Value(res, expr.key);

    for (let member of entity.traits) {
      const [, memberKey] = Value(res, member.key);
      if (key.match(res, memberKey)) {
        return unit(member);
      }
    }

    return fail(
      [new L10nError('Unknown trait: ' + key.format(res))],
      Value(res, entity)
    );
  }

  function SelectExpression(res, expr) {
    const [selErrs, selector] = Value(res, expr.exp);
    if (selErrs.length) {
      return fail(selErrs, DefaultMember(expr.vars));
    }

    for (let variant of expr.vars) {
      const [, key] = Value(res, variant.key);
      if (selector.match(res, key)) {
        return unit(variant);
      }
    }

    return DefaultMember(expr.vars);
  }


  // Fully-resolved expressions

  function Value(res, expr) {
    if (typeof expr === 'string') {
      return unit(new FTLText(expr));
    }

    if (Array.isArray(expr)) {
      return Pattern(res, expr);
    }

    if (expr instanceof FTLNone) {
      return unit(expr);
    }

    const [errs, node] = Expression(res, expr);
    if (errs.length) {
      return fail(errs, Value(res, node));
    }

    switch (node.type) {
      case 'id':
        return unit(new FTLKeyword(node.name, node.ns));
      case 'num':
        return unit(new FTLNumber(node.val));
      case 'ext':
        return ExternalArgument(res, node);
      case 'kv':
        return KeyValueArg(res, expr);
      case 'call':
        return CallExpression(res, expr);
      default:
        if (node.key) {
          // if it's a Member
          return Value(res, node.val);
        }
        return Entity(res, node);
    }
  }

  function ExternalArgument(res, expr) {
    const name = expr.name;
    const args = res.args;

    if (!args || !args.hasOwnProperty(name)) {
      return fail(
        [new L10nError('Unknown external: ' + name)],
        unit(new FTLNone(name))
      );
    }

    const arg = args[name];

    switch (typeof arg) {
      case 'number': return unit(new FTLNumber(arg));
      case 'string': return unit(new FTLText(arg));
      default: return fail(
        [new L10nError('Unsupported external type: ' + name + ', ' + typeof arg)],
        unit(new FTLNone(name))
      );
    }
  }

  function KeyValueArg(res, expr) {
    const [errs, value] = Value(res, expr.val);
    return [
      errs,
      new FTLKeyValueArg(value, expr.name)
    ];
  }

  function CallExpression(res, expr) {
    const [errs1, callee] = Expression(res, expr.name);
    if (errs1.length) {
      return fail(errs1, unit(callee));
    }


    const [errs2, args] = mapValues(res, expr.args);
    const [pargs, kargs] = args.value.reduce(
      ([pargs, kargs], arg) => arg instanceof FTLKeyValueArg ?
        [pargs, Object.assign({}, kargs, {
          [arg.id]: arg.value
        })] :
        [[...pargs, arg], kargs],
      [[], {}]);
    return [errs2, callee(pargs, kargs)];
  }

  function Pattern(res, ptn) {
    if (res.dirty.has(ptn)) {
      return fail(
        [new L10nError('Cyclic reference')],
        unit(new FTLNone())
      );
    }

    res.dirty.add(ptn);
    const rv = formatPattern(res, ptn);
    res.dirty.delete(ptn);
    return rv;
  }

  function Entity(res, entity) {
    if (!entity.traits) {
      return Value(res, entity);
    }

    if (entity.val !== undefined) {
      return Value(res, entity.val);
    }

    const [errs, def] = DefaultMember(entity.traits);

    if (errs.length) {
      return fail(
        [...errs, new L10nError('No value')],
        unit(new FTLNone())
      );
    }

    return Value(res, def.val);
  }


  // formatPattern collects errors and returns them as the first element of 
  // the return tuple: [errors, value]

  function formatPattern(res, ptn) {
    return ptn.reduce(([errSeq, valSeq], elem) => {
      if (typeof elem === 'string') {
        return [errSeq, new FTLText(valSeq.format(res) + elem)];
      } else {
        const [errs, value] = mapValues(res, elem);
        return [
          [...errSeq, ...errs],
          new FTLText(valSeq.format(res) + FSI + value.format(res) + PDI),
        ];
      }

    }, [[], new FTLText('')]);
  }

  function format(ctx, lang, args, entity) {
    const res = {
      ctx,
      lang,
      args,
      dirty: new WeakSet()
    };

    const [errs, value] = Entity(res, entity);
    return [errs, value.format(res)];
  }

  class Context {
    constructor(env, langs, resIds) {
      this.langs = langs;
      this.resIds = resIds;
      this.env = env;
      this.emit = (type, evt) => env.emit(type, evt, this);
    }

    _formatTuple(lang, args, entity, id, key) {
      try {
        return format(this, lang, args, entity);
      } catch (err) {
        err.id = key ? id + '::' + key : id;
        err.lang = lang;
        this.emit('resolveerror', err);
        return [{ error: err }, err.id];
      }
    }

    _formatEntity(lang, args, entity, id) {
      const [, value] = this._formatTuple(lang, args, entity, id);

      const formatted = {
        value,
        attrs: null,
      };

      if (entity.attrs) {
        formatted.attrs = Object.create(null);
        for (let key in entity.attrs) {
          /* jshint -W089 */
          const [, attrValue] = this._formatTuple(
            lang, args, entity.attrs[key], id, key);
          formatted.attrs[key] = attrValue;
        }
      }

      return formatted;
    }

    _formatValue(lang, args, entity, id) {
      return this._formatTuple(lang, args, entity, id)[1];
    }

    fetch(langs = this.langs) {
      if (langs.length === 0) {
        return Promise.resolve(langs);
      }

      return Promise.all(
        this.resIds.map(
          resId => this.env._getResource(langs[0], resId))
      ).then(() => langs);
    }

    _resolve(langs, keys, formatter, prevResolved) {
      const lang = langs[0];

      if (!lang) {
        return reportMissing.call(this, keys, formatter, prevResolved);
      }

      let hasUnresolved = false;

      const resolved = keys.map((key, i) => {
        if (prevResolved && prevResolved[i] !== undefined) {
          return prevResolved[i];
        }
        const [id, args] = Array.isArray(key) ?
          key : [key, undefined];
        const entity = this._getEntity(lang, id);

        if (entity) {
          return formatter.call(this, lang, args, entity, id);
        }

        this.emit('notfounderror',
          new L10nError('"' + id + '" not found in ' + lang.code, id, lang));
        hasUnresolved = true;
      });

      if (!hasUnresolved) {
        return resolved;
      }

      return this.fetch(langs.slice(1)).then(
        nextLangs => this._resolve(nextLangs, keys, formatter, resolved));
    }

    formatEntities(...keys) {
      return this.fetch().then(
        langs => this._resolve(langs, keys, this._formatEntity));
    }

    formatValues(...keys) {
      return this.fetch().then(
        langs => this._resolve(langs, keys, this._formatValue));
    }

    _getEntity(lang, name) {
      const cache = this.env.resCache;

      // Look for `name` in every resource in order.
      for (let i = 0, resId; resId = this.resIds[i]; i++) {
        const resource = cache.get(resId + lang.code + lang.src);
        if (resource instanceof L10nError) {
          continue;
        }
        if (name in resource.entries) {
          return resource.entries[name];
        }
      }
      return undefined;
    }

    _memoizeIntlObject(ctor, {code}, opts) {
      return new ctor(code, opts);
    }

  }

  function reportMissing(keys, formatter, resolved) {
    const missingIds = new Set();

    keys.forEach((key, i) => {
      if (resolved && resolved[i] !== undefined) {
        return;
      }
      const id = Array.isArray(key) ? key[0] : key;
      missingIds.add(id);
      resolved[i] = formatter === this._formatValue ?
        id : {value: id, attrs: null};
    });

    this.emit('notfounderror', new L10nError(
      '"' + Array.from(missingIds).join(', ') + '"' +
      ' not found in any language', missingIds));

    return resolved;
  }

  const lang = {
    code:'en-US',
    src: 'app',
  };

  function MockContext(entries) {
    return {
      env: {},
      _getEntity(lang, name) {
        return entries[name];
      },
      _memoizeIntlObject: Context.prototype._memoizeIntlObject,
    };
  }

  var index = {
    Parser: FTLEntriesParser,
    Context: MockContext,
    format,
    lang
  };

  return index;

}());