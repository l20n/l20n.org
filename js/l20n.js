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

  const HTTP_STATUS_CODE_OK = 200;

  function load(type, url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (xhr.overrideMimeType) {
        xhr.overrideMimeType(type);
      }

      xhr.open('GET', url, true);

      if (type === 'application/json') {
        xhr.responseType = 'json';
      }

      xhr.addEventListener('load', e => {
        if (e.target.status === HTTP_STATUS_CODE_OK ||
            e.target.status === 0) {
          resolve(e.target.response);
        } else {
          reject(new L10nError('Not found: ' + url));
        }
      });
      xhr.addEventListener('error', reject);
      xhr.addEventListener('timeout', reject);

      // the app: protocol throws on 404, see https://bugzil.la/827243
      try {
        xhr.send(null);
      } catch (e) {
        if (e.name === 'NS_ERROR_FILE_NOT_FOUND') {
          // the app: protocol throws on 404, see https://bugzil.la/827243
          reject(new L10nError('Not found: ' + url));
        } else {
          throw e;
        }
      }
    });
  }

  const io = {
    extra: function(code, ver, path, type) {
      return navigator.mozApps.getLocalizationResource(
        code, ver, path, type);
    },
    app: function(code, ver, path, type) {
      switch (type) {
        case 'text':
          return load('text/plain', path);
        case 'json':
          return load('application/json', path);
        default:
          throw new L10nError('Unknown file type: ' + type);
      }
    },
  };

  function fetchResource(res, { code, src, ver }) {
    const url = res.replace('{locale}', code);
    const type = res.endsWith('.json') ? 'json' : 'text';
    return io[src](code, ver, url, type);
  }

  function emit(listeners, ...args) {
    const type = args.shift();

    if (listeners['*']) {
      listeners['*'].slice().forEach(
        listener => listener.apply(this, args));
    }

    if (listeners[type]) {
      listeners[type].slice().forEach(
        listener => listener.apply(this, args));
    }
  }

  function addEventListener(listeners, type, listener) {
    if (!(type in listeners)) {
      listeners[type] = [];
    }
    listeners[type].push(listener);
  }

  function removeEventListener(listeners, type, listener) {
    const typeListeners = listeners[type];
    const pos = typeListeners.indexOf(listener);
    if (pos === -1) {
      return;
    }

    typeListeners.splice(pos, 1);
  }

  class Client {
    constructor(remote) {
      this.id = this;
      this.remote = remote;

      const listeners = {};
      this.on = (...args) => addEventListener(listeners, ...args);
      this.emit = (...args) => emit(listeners, ...args);
    }

    method(name, ...args) {
      return this.remote[name](...args);
    }
  }

  function broadcast(type, data) {
    Array.from(this.ctxs.keys()).forEach(
      client => client.emit(type, data));
  }

  // Polyfill NodeList.prototype[Symbol.iterator] for Chrome.
  // See https://code.google.com/p/chromium/issues/detail?id=401699
  if (typeof NodeList === 'function' && !NodeList.prototype[Symbol.iterator]) {
    NodeList.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }

  // A document.ready shim
  // https://github.com/whatwg/html/issues/127
  function documentReady() {
    if (document.readyState !== 'loading') {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      document.addEventListener('readystatechange', function onrsc() {
        document.removeEventListener('readystatechange', onrsc);
        resolve();
      });
    });
  }

  // Intl.Locale
  function getDirection(code) {
    const tag = code.split('-')[0];
    return ['ar', 'he', 'fa', 'ps', 'ur'].indexOf(tag) >= 0 ?
      'rtl' : 'ltr';
  }

  // Opera and Safari don't support it yet
  if (typeof navigator !== 'undefined' && navigator.languages === undefined) {
    navigator.languages = [navigator.language];
  }

  function getResourceLinks(head) {
    return Array.prototype.map.call(
      head.querySelectorAll('link[rel="localization"]'),
      el => el.getAttribute('href'));
  }

  function getMeta(head) {
    let availableLangs = Object.create(null);
    let defaultLang = null;
    let appVersion = null;

    // XXX take last found instead of first?
    const metas = Array.from(head.querySelectorAll(
      'meta[name="availableLanguages"],' +
      'meta[name="defaultLanguage"],' +
      'meta[name="appVersion"]'));
    for (let meta of metas) {
      const name = meta.getAttribute('name');
      const content = meta.getAttribute('content').trim();
      switch (name) {
        case 'availableLanguages':
          availableLangs = getLangRevisionMap(
            availableLangs, content);
          break;
        case 'defaultLanguage':
          const [lang, rev] = getLangRevisionTuple(content);
          defaultLang = lang;
          if (!(lang in availableLangs)) {
            availableLangs[lang] = rev;
          }
          break;
        case 'appVersion':
          appVersion = content;
      }
    }

    return {
      defaultLang,
      availableLangs,
      appVersion
    };
  }

  function getLangRevisionMap(seq, str) {
    return str.split(',').reduce((prevSeq, cur) => {
      const [lang, rev] = getLangRevisionTuple(cur);
      prevSeq[lang] = rev;
      return prevSeq;
    }, seq);
  }

  function getLangRevisionTuple(str) {
    const [lang, rev]  = str.trim().split(':');
    // if revision is missing, use NaN
    return [lang, parseInt(rev)];
  }

  // match the opening angle bracket (<) in HTML tags, and HTML entities like
  // &amp;, &#0038;, &#x0026;.
  const reOverlay = /<|&#?\w+;/;

  const allowed = {
    elements: [
      'a', 'em', 'strong', 'small', 's', 'cite', 'q', 'dfn', 'abbr', 'data',
      'time', 'code', 'var', 'samp', 'kbd', 'sub', 'sup', 'i', 'b', 'u',
      'mark', 'ruby', 'rt', 'rp', 'bdi', 'bdo', 'span', 'br', 'wbr'
    ],
    attributes: {
      global: ['title', 'aria-label', 'aria-valuetext', 'aria-moz-hint'],
      a: ['download'],
      area: ['download', 'alt'],
      // value is special-cased in isAttrAllowed
      input: ['alt', 'placeholder'],
      menuitem: ['label'],
      menu: ['label'],
      optgroup: ['label'],
      option: ['label'],
      track: ['label'],
      img: ['alt'],
      textarea: ['placeholder'],
      th: ['abbr']
    }
  };

  function overlayElement(element, translation) {
    const value = translation.value;

    if (typeof value === 'string') {
      if (!reOverlay.test(value)) {
        element.textContent = value;
      } else {
        // start with an inert template element and move its children into
        // `element` but such that `element`'s own children are not replaced
        const tmpl = element.ownerDocument.createElement('template');
        tmpl.innerHTML = value;
        // overlay the node with the DocumentFragment
        overlay(element, tmpl.content);
      }
    }

    for (let key in translation.attrs) {
      const attrName = camelCaseToDashed(key);
      if (isAttrAllowed({ name: attrName }, element)) {
        element.setAttribute(attrName, translation.attrs[key]);
      }
    }
  }

  // The goal of overlay is to move the children of `translationElement`
  // into `sourceElement` such that `sourceElement`'s own children are not
  // replaced, but onle have their text nodes and their attributes modified.
  //
  // We want to make it possible for localizers to apply text-level semantics to
  // the translations and make use of HTML entities. At the same time, we
  // don't trust translations so we need to filter unsafe elements and
  // attribtues out and we don't want to break the Web by replacing elements to
  // which third-party code might have created references (e.g. two-way
  // bindings in MVC frameworks).
  function overlay(sourceElement, translationElement) {
    const result = translationElement.ownerDocument.createDocumentFragment();
    let k, attr;

    // take one node from translationElement at a time and check it against
    // the allowed list or try to match it with a corresponding element
    // in the source
    let childElement;
    while ((childElement = translationElement.childNodes[0])) {
      translationElement.removeChild(childElement);

      if (childElement.nodeType === childElement.TEXT_NODE) {
        result.appendChild(childElement);
        continue;
      }

      const index = getIndexOfType(childElement);
      const sourceChild = getNthElementOfType(sourceElement, childElement, index);
      if (sourceChild) {
        // there is a corresponding element in the source, let's use it
        overlay(sourceChild, childElement);
        result.appendChild(sourceChild);
        continue;
      }

      if (isElementAllowed(childElement)) {
        const sanitizedChild = childElement.ownerDocument.createElement(
          childElement.nodeName);
        overlay(sanitizedChild, childElement);
        result.appendChild(sanitizedChild);
        continue;
      }

      // otherwise just take this child's textContent
      result.appendChild(
        translationElement.ownerDocument.createTextNode(
          childElement.textContent));
    }

    // clear `sourceElement` and append `result` which by this time contains
    // `sourceElement`'s original children, overlayed with translation
    sourceElement.textContent = '';
    sourceElement.appendChild(result);

    // if we're overlaying a nested element, translate the allowed
    // attributes; top-level attributes are handled in `translateElement`
    // XXX attributes previously set here for another language should be
    // cleared if a new language doesn't use them; https://bugzil.la/922577
    if (translationElement.attributes) {
      for (k = 0, attr; (attr = translationElement.attributes[k]); k++) {
        if (isAttrAllowed(attr, sourceElement)) {
          sourceElement.setAttribute(attr.name, attr.value);
        }
      }
    }
  }

  // XXX the allowed list should be amendable; https://bugzil.la/922573
  function isElementAllowed(element) {
    return allowed.elements.indexOf(element.tagName.toLowerCase()) !== -1;
  }

  function isAttrAllowed(attr, element) {
    const attrName = attr.name.toLowerCase();
    const tagName = element.tagName.toLowerCase();
    // is it a globally safe attribute?
    if (allowed.attributes.global.indexOf(attrName) !== -1) {
      return true;
    }
    // are there no allowed attributes for this element?
    if (!allowed.attributes[tagName]) {
      return false;
    }
    // is it allowed on this element?
    // XXX the allowed list should be amendable; https://bugzil.la/922573
    if (allowed.attributes[tagName].indexOf(attrName) !== -1) {
      return true;
    }
    // special case for value on inputs with type button, reset, submit
    if (tagName === 'input' && attrName === 'value') {
      const type = element.type.toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'reset') {
        return true;
      }
    }
    return false;
  }

  // Get n-th immediate child of context that is of the same type as element.
  // XXX Use querySelector(':scope > ELEMENT:nth-of-type(index)'), when:
  // 1) :scope is widely supported in more browsers and 2) it works with
  // DocumentFragments.
  function getNthElementOfType(context, element, index) {
    /* jshint boss:true */
    let nthOfType = 0;
    for (let i = 0, child; child = context.children[i]; i++) {
      if (child.nodeType === child.ELEMENT_NODE &&
          child.tagName === element.tagName) {
        if (nthOfType === index) {
          return child;
        }
        nthOfType++;
      }
    }
    return null;
  }

  // Get the index of the element among siblings of the same type.
  function getIndexOfType(element) {
    let index = 0;
    let child;
    while ((child = element.previousElementSibling)) {
      if (child.tagName === element.tagName) {
        index++;
      }
    }
    return index;
  }

  function camelCaseToDashed(string) {
    // XXX workaround for https://bugzil.la/1141934
    if (string === 'ariaValueText') {
      return 'aria-valuetext';
    }

    return string
      .replace(/[A-Z]/g, match => '-' + match.toLowerCase())
      .replace(/^-/, '');
  }

  const reHtml = /[&<>]/g;
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  };

  function setAttributes(element, id, args) {
    element.setAttribute('data-l10n-id', id);
    if (args) {
      element.setAttribute('data-l10n-args', JSON.stringify(args));
    }
  }

  function getAttributes(element) {
    return {
      id: element.getAttribute('data-l10n-id'),
      args: JSON.parse(element.getAttribute('data-l10n-args'))
    };
  }

  function getTranslatables(element) {
    const nodes = Array.from(element.querySelectorAll('[data-l10n-id]'));

    if (typeof element.hasAttribute === 'function' &&
        element.hasAttribute('data-l10n-id')) {
      nodes.push(element);
    }

    return nodes;
  }

  function translateMutations(view, mutations) {
    const targets = new Set();

    for (let mutation of mutations) {
      switch (mutation.type) {
        case 'attributes':
          targets.add(mutation.target);
          break;
        case 'childList':
          for (let addedNode of mutation.addedNodes) {
            if (addedNode.nodeType === addedNode.ELEMENT_NODE) {
              if (addedNode.childElementCount) {
                getTranslatables(addedNode).forEach(targets.add.bind(targets));
              } else {
                if (addedNode.hasAttribute('data-l10n-id')) {
                  targets.add(addedNode);
                }
              }
            }
          }
          break;
      }
    }

    if (targets.size === 0) {
      return;
    }

    translateElements(view, Array.from(targets));
  }

  function translateFragment(view, frag) {
    return translateElements(view, getTranslatables(frag));
  }

  function getElementsTranslation(view, elems) {
    const keys = elems.map(elem => {
      const id = elem.getAttribute('data-l10n-id');
      const args = elem.getAttribute('data-l10n-args');
      return args ? [
        id,
        JSON.parse(args.replace(reHtml, match => htmlEntities[match]))
      ] : id;
    });

    return view.formatEntities(...keys);
  }

  function translateElements(view, elements) {
    return getElementsTranslation(view, elements).then(
      translations => applyTranslations(view, elements, translations));
  }

  function applyTranslations(view, elems, translations) {
    disconnect(view, null, true);
    for (let i = 0; i < elems.length; i++) {
      overlayElement(elems[i], translations[i]);
    }
    reconnect(view);
  }

  const observerConfig = {
    attributes: true,
    characterData: false,
    childList: true,
    subtree: true,
    attributeFilter: ['data-l10n-id', 'data-l10n-args']
  };

  const observers = new WeakMap();

  function initMutationObserver(view) {
    observers.set(view, {
      roots: new Set(),
      observer: new MutationObserver(
        mutations => translateMutations(view, mutations)),
    });
  }

  function translateRoots(view) {
    const roots = Array.from(observers.get(view).roots);
    return Promise.all(roots.map(
        root => translateFragment(view, root)));
  }

  function observe(view, root) {
    const obs = observers.get(view);
    if (obs) {
      obs.roots.add(root);
      obs.observer.observe(root, observerConfig);
    }
  }

  function disconnect(view, root, allRoots) {
    const obs = observers.get(view);
    if (obs) {
      obs.observer.disconnect();
      if (allRoots) {
        return;
      }
      obs.roots.delete(root);
      obs.roots.forEach(
        other => obs.observer.observe(other, observerConfig));
    }
  }

  function reconnect(view) {
    const obs = observers.get(view);
    if (obs) {
      obs.roots.forEach(
        root => obs.observer.observe(root, observerConfig));
    }
  }

  const viewProps = new WeakMap();

  class View {
    constructor(client, doc) {
      this.pseudo = {
        'fr-x-psaccent': createPseudo(this, 'fr-x-psaccent'),
        'ar-x-psbidi': createPseudo(this, 'ar-x-psbidi')
      };

      const initialized = documentReady().then(() => init(this, client));
      this._interactive = initialized.then(() => client);
      this.ready = initialized.then(langs => translateView(this, langs));
      initMutationObserver(this);

      viewProps.set(this, {
        doc: doc,
        ready: false
      });

      client.on('languageschangerequest',
        requestedLangs => this.requestLanguages(requestedLangs));
    }

    requestLanguages(requestedLangs, isGlobal) {
      const method = isGlobal ?
        (client => client.method('requestLanguages', requestedLangs)) :
        (client => changeLanguages(this, client, requestedLangs));
      return this._interactive.then(method);
    }

    handleEvent() {
      return this.requestLanguages(navigator.languages);
    }

    formatEntities(...keys) {
      return this._interactive.then(
        client => client.method('formatEntities', client.id, keys));
    }

    formatValue(id, args) {
      return this._interactive.then(
        client => client.method('formatValues', client.id, [[id, args]])).then(
        values => values[0]);
    }

    formatValues(...keys) {
      return this._interactive.then(
        client => client.method('formatValues', client.id, keys));
    }

    translateFragment(frag) {
      return translateFragment(this, frag);
    }

    observeRoot(root) {
      observe(this, root);
    }

    disconnectRoot(root) {
      disconnect(this, root);
    }
  }

  View.prototype.setAttributes = setAttributes;
  View.prototype.getAttributes = getAttributes;

  function createPseudo(view, code) {
    return {
      getName: () => view._interactive.then(
        client => client.method('getName', code)),
      processString: str => view._interactive.then(
        client => client.method('processString', code, str)),
    };
  }

  function init(view, client) {
    const doc = viewProps.get(view).doc;
    const resources = getResourceLinks(doc.head);
    const meta = getMeta(doc.head);
    view.observeRoot(doc.documentElement);
    return getAdditionalLanguages().then(
      additionalLangs => client.method(
        'registerView', client.id, resources, meta, additionalLangs,
        navigator.languages));
  }

  function changeLanguages(view, client, requestedLangs) {
    const doc = viewProps.get(view).doc;
    const meta = getMeta(doc.head);
    return getAdditionalLanguages()
      .then(additionalLangs => client.method(
        'changeLanguages', client.id, meta, additionalLangs, requestedLangs
      ))
      .then(({langs, haveChanged}) => haveChanged ?
        translateView(view, langs) : undefined
      );
  }

  function getAdditionalLanguages() {
    if (navigator.mozApps && navigator.mozApps.getAdditionalLanguages) {
      return navigator.mozApps.getAdditionalLanguages()
        .catch(() => Object.create(null));
    }

    return Promise.resolve(Object.create(null));
  }

  function translateView(view, langs) {
    const props = viewProps.get(view);
    const html = props.doc.documentElement;

    if (props.ready) {
      return translateRoots(view).then(
        () => setAllAndEmit(html, langs));
    }

    const translated =
      // has the document been already pre-translated?
      langs[0].code === html.getAttribute('lang') ?
        Promise.resolve() :
        translateRoots(view).then(
          () => setLangDir(html, langs));

    return translated.then(() => {
      setLangs(html, langs);
      props.ready = true;
    });
  }

  function setLangs(html, langs) {
    const codes = langs.map(lang => lang.code);
    html.setAttribute('langs', codes.join(' '));
  }

  function setLangDir(html, langs) {
    const code = langs[0].code;
    html.setAttribute('lang', code);
    html.setAttribute('dir', getDirection(code));
  }

  function setAllAndEmit(html, langs) {
    setLangDir(html, langs);
    setLangs(html, langs);
    html.parentNode.dispatchEvent(new CustomEvent('DOMRetranslated', {
      bubbles: false,
      cancelable: false,
    }));
  }

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
    constructor(value, opts) {
      this.value = value;
      this.opts = opts;
    }
    format() {
      return this.value || '???';
    }
    match() {
      return false;
    }
  };

  class FTLText extends FTLNone {
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

  class FTLDateTime extends FTLText {
    constructor(value, opts) {
      super(new Date(value));
      this.opts = opts;
    }
    format(res) {
      const dtf = res.ctx._memoizeIntlObject(
        L20nIntl.DateTimeFormat, res.lang, this.opts
      );
      return dtf.format(this.value);
    }
    match() {
      return false;
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
    'NUMBER': ([arg], opts) => new FTLNumber(arg.value, values(opts)),
    'DATETIME': ([arg], opts) => new FTLDateTime(arg.value, values(opts)),
    'PLURAL': ([arg], opts) => new FTLCategory(arg.value, values(opts)),
    'LIST': (...args) => new FTLList(...args),
    'LEN': ([arg], opts) => new FTLNumber(arg.value.length, values(opts)),
    'TAKE': ([num, arg], opts) =>
      new FTLList(arg.value.slice(0, num.value), values(opts)),
    'DROP': ([num, arg], opts) =>
      new FTLList(arg.value.slice(num.value), values(opts)),
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
      return [
        [new L10nError('Unknown external: ' + name)],
        new FTLNone(name)
      ];
    }

    const arg = args[name];

    switch (typeof arg) {
      case 'number':
        return unit(new FTLNumber(arg));
      case 'string':
        return unit(new FTLText(arg));
      case 'object':
        if (Array.isArray(arg)) {
          return mapValues(res, arg);
        }

        if (arg instanceof Date) {
          return unit(new FTLDateTime(arg));
        }
      default:
        return [
          [new L10nError(
            'Unsupported external type: ' + name + ', ' + typeof arg
          )],
          new FTLNone(name)
        ];
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
      let start = this._index;
      if (this._source[start] === '"') {
        return this.getComplexPattern();
      }
      let eol = this._source.indexOf('\n', this._index);

      if (eol === -1) {
        eol = this._length;
      }

      let line = this._source.slice(start, eol);

      if (line.indexOf('{') !== -1) {
        return this.getComplexPattern();
      }

      this._index = eol + 1;

      this.getWS();

      if (this._source[this._index] === '|') {
        this._index = start;
        return this.getComplexPattern();
      }

      return this._source.slice(start, eol);
    }

    getComplexPattern() {
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

  // Walk an entry node searching for content leaves
  function walkEntry(entry, fn) {
    if (typeof entry === 'string') {
      return fn(entry);
    }

    const newEntry = Object.create(null);

    if (entry.value) {
      newEntry.value = walkValue(entry.value, fn);
    }

    if (entry.index) {
      newEntry.index = entry.index;
    }

    if (entry.attrs) {
      newEntry.attrs = Object.create(null);
      for (let key in entry.attrs) {
        newEntry.attrs[key] = walkEntry(entry.attrs[key], fn);
      }
    }

    return newEntry;
  }

  function walkValue(value, fn) {
    if (typeof value === 'string') {
      return fn(value);
    }

    // skip expressions in placeables
    if (value.type) {
      return value;
    }

    const newValue = Array.isArray(value) ? [] : Object.create(null);
    const keys = Object.keys(value);

    for (let i = 0, key; (key = keys[i]); i++) {
      newValue[key] = walkValue(value[key], fn);
    }

    return newValue;
  }

  /* Pseudolocalizations
   *
   * pseudo is a dict of strategies to be used to modify the English
   * context in order to create pseudolocalizations.  These can be used by
   * developers to test the localizability of their code without having to
   * actually speak a foreign language.
   *
   * Currently, the following pseudolocales are supported:
   *
   *   fr-x-psaccent - Ȧȧƈƈḗḗƞŧḗḗḓ Ḗḗƞɠŀīīşħ
   *
   *     In Accented English all English letters are replaced by accented
   *     Unicode counterparts which don't impair the readability of the content.
   *     This allows developers to quickly test if any given string is being
   *     correctly displayed in its 'translated' form.  Additionally, simple
   *     heuristics are used to make certain words longer to better simulate the
   *     experience of international users.
   *
   *   ar-x-psbidi - ɥsıʅƃuƎ ıpıԐ
   *
   *     Bidi English is a fake RTL locale.  All words are surrounded by
   *     Unicode formatting marks forcing the RTL directionality of characters.
   *     In addition, to make the reversed text easier to read, individual
   *     letters are flipped.
   *
   *     Note: The name above is hardcoded to be RTL in case code editors have
   *     trouble with the RLO and PDF Unicode marks.  In reality, it should be
   *     surrounded by those marks as well.
   *
   * See https://bugzil.la/900182 for more information.
   *
   */

  function createGetter(id, name) {
    let _pseudo = null;

    return function getPseudo() {
      if (_pseudo) {
        return _pseudo;
      }

      const reAlphas = /[a-zA-Z]/g;
      const reVowels = /[aeiouAEIOU]/g;
      const reWords = /[^\W0-9_]+/g;
      // strftime tokens (%a, %Eb), template {vars}, HTML entities (&#x202a;)
      // and HTML tags.
      const reExcluded = /(%[EO]?\w|\{\s*.+?\s*\}|&[#\w]+;|<\s*.+?\s*>)/;

      const charMaps = {
        'fr-x-psaccent':
          'ȦƁƇḒḖƑƓĦĪĴĶĿḾȠǾƤɊŘŞŦŬṼẆẊẎẐ[\\]^_`ȧƀƈḓḗƒɠħīĵķŀḿƞǿƥɋřşŧŭṽẇẋẏẑ',
        'ar-x-psbidi':
          // XXX Use pɟפ˥ʎ as replacements for ᗡℲ⅁⅂⅄. https://bugzil.la/1007340
          '∀ԐↃpƎɟפHIſӼ˥WNOԀÒᴚS⊥∩ɅＭXʎZ[\\]ᵥ_,ɐqɔpǝɟƃɥıɾʞʅɯuodbɹsʇnʌʍxʎz',
      };

      const mods = {
        'fr-x-psaccent': val =>
          val.replace(reVowels, match => match + match.toLowerCase()),

        // Surround each word with Unicode formatting codes, RLO and PDF:
        //   U+202E:   RIGHT-TO-LEFT OVERRIDE (RLO)
        //   U+202C:   POP DIRECTIONAL FORMATTING (PDF)
        // See http://www.w3.org/International/questions/qa-bidi-controls
        'ar-x-psbidi': val =>
          val.replace(reWords, match => '\u202e' + match + '\u202c'),
      };

      // Replace each Latin letter with a Unicode character from map
      const ASCII_LETTER_A = 65;
      const replaceChars =
        (map, val) => val.replace(
          reAlphas, match => map.charAt(match.charCodeAt(0) - ASCII_LETTER_A));

      const transform =
        val => replaceChars(charMaps[id], mods[id](val));

      // apply fn to translatable parts of val
      const apply = (fn, val) => {
        if (!val) {
          return val;
        }

        const parts = val.split(reExcluded);
        const modified = parts.map((part) => {
          if (reExcluded.test(part)) {
            return part;
          }
          return fn(part);
        });
        return modified.join('');
      };

      return _pseudo = {
        name: transform(name),
        process: str => apply(transform, str)
      };
    };
  }

  const pseudo = Object.defineProperties(Object.create(null), {
    'fr-x-psaccent': {
      enumerable: true,
      get: createGetter('fr-x-psaccent', 'Runtime Accented')
    },
    'ar-x-psbidi': {
      enumerable: true,
      get: createGetter('ar-x-psbidi', 'Runtime Bidi')
    }
  });

  class Env {
    constructor(fetchResource) {
      this.fetchResource = fetchResource;

      this.resCache = new Map();
      this.resRefs = new Map();
      this.builtins = null;
      this.parsers = {
        ftl: FTLEntriesParser
      };

      const listeners = {};
      this.emit = emit.bind(this, listeners);
      this.addEventListener = addEventListener.bind(this, listeners);
      this.removeEventListener = removeEventListener.bind(this, listeners);
    }

    createContext(langs, resIds) {
      const ctx = new Context(this, langs, resIds);
      resIds.forEach(resId => {
        const usedBy = this.resRefs.get(resId) || 0;
        this.resRefs.set(resId, usedBy + 1);
      });

      return ctx;
    }

    destroyContext(ctx) {
      ctx.resIds.forEach(resId => {
        const usedBy = this.resRefs.get(resId) || 0;

        if (usedBy > 1) {
          return this.resRefs.set(resId, usedBy - 1);
        }

        this.resRefs.delete(resId);
        this.resCache.forEach((val, key) =>
          key.startsWith(resId) ? this.resCache.delete(key) : null);
      });
    }

    _parse(syntax, lang, data) {
      const parser = this.parsers[syntax];
      if (!parser) {
        return data;
      }

      const emitAndAmend = (type, err) => this.emit(type, amendError(lang, err));
      return parser.parseResource(data);
    }

    _create(lang, entries) {
      if (lang.src !== 'pseudo') {
        return entries;
      }

      const pseudoentries = Object.create(null);
      for (let key in entries) {
        pseudoentries[key] = walkEntry(
          entries[key], pseudo[lang.code].process);
      }
      return pseudoentries;
    }

    _getResource(lang, res) {
      const cache = this.resCache;
      const id = res + lang.code + lang.src;

      if (cache.has(id)) {
        return cache.get(id);
      }

      const syntax = res.substr(res.lastIndexOf('.') + 1);

      const saveEntries = data => {
        const entries = this._parse(syntax, lang, data);
        cache.set(id, this._create(lang, entries));
      };

      const recover = err => {
        err.lang = lang;
        this.emit('fetcherror', err);
        cache.set(id, err);
      };

      const langToFetch = lang.src === 'pseudo' ?
        { code: 'en-US', src: 'app', ver: lang.ver } :
        lang;

      const resource = this.fetchResource(res, langToFetch)
        .then(saveEntries, recover);

      cache.set(id, resource);

      return resource;
    }
  }

  function amendError(lang, err) {
    err.lang = lang;
    return err;
  }

  function prioritizeLocales(def, availableLangs, requested) {
    let supportedLocale;
    // Find the first locale in the requested list that is supported.
    for (let i = 0; i < requested.length; i++) {
      const locale = requested[i];
      if (availableLangs.indexOf(locale) !== -1) {
        supportedLocale = locale;
        break;
      }
    }
    if (!supportedLocale ||
        supportedLocale === def) {
      return [def];
    }

    return [supportedLocale, def];
  }

  function negotiateLanguages(
    { appVersion, defaultLang, availableLangs }, additionalLangs, prevLangs,
    requestedLangs) {

    const allAvailableLangs = Object.keys(availableLangs)
      .concat(Object.keys(additionalLangs))
      .concat(Object.keys(pseudo));
    const newLangs = prioritizeLocales(
      defaultLang, allAvailableLangs, requestedLangs);

    const langs = newLangs.map(code => ({
      code: code,
      src: getLangSource(appVersion, availableLangs, additionalLangs, code),
      ver: appVersion,
    }));

    return { langs, haveChanged: !arrEqual(prevLangs, newLangs) };
  }

  function arrEqual(arr1, arr2) {
    return arr1.length === arr2.length &&
      arr1.every((elem, i) => elem === arr2[i]);
  }

  function getMatchingLangpack(appVersion, langpacks) {
    for (let i = 0, langpack; (langpack = langpacks[i]); i++) {
      if (langpack.target === appVersion) {
        return langpack;
      }
    }
    return null;
  }

  function getLangSource(appVersion, availableLangs, additionalLangs, code) {
    if (additionalLangs && additionalLangs[code]) {
      const lp = getMatchingLangpack(appVersion, additionalLangs[code]);
      if (lp &&
          (!(code in availableLangs) ||
           parseInt(lp.revision) > availableLangs[code])) {
        return 'extra';
      }
    }

    if ((code in pseudo) && !(code in availableLangs)) {
      return 'pseudo';
    }

    return 'app';
  }

  class Remote {
    constructor(fetchResource, broadcast) {
      this.broadcast = broadcast;
      this.env = new Env(fetchResource);
      this.ctxs = new Map();
    }

    registerView(view, resources, meta, additionalLangs, requestedLangs) {
      const { langs } = negotiateLanguages(
        meta, additionalLangs, [], requestedLangs);
      this.ctxs.set(view, this.env.createContext(langs, resources));
      return langs;
    }

    unregisterView(view) {
      this.ctxs.delete(view);
      return true;
    }

    formatEntities(view, keys) {
      return this.ctxs.get(view).formatEntities(...keys);
    }

    formatValues(view, keys) {
      return this.ctxs.get(view).formatValues(...keys);
    }

    changeLanguages(view, meta, additionalLangs, requestedLangs) {
      const oldCtx = this.ctxs.get(view);
      const prevLangs = oldCtx.langs;
      const newLangs = negotiateLanguages(
        meta, additionalLangs, prevLangs, requestedLangs);
      this.ctxs.set(view, this.env.createContext(
        newLangs.langs, oldCtx.resIds));
      return newLangs;
    }

    requestLanguages(requestedLangs) {
      this.broadcast('languageschangerequest', requestedLangs);
    }

    getName(code) {
      return pseudo[code].name;
    }

    processString(code, str) {
      return pseudo[code].process(str);
    }
  }

  class Node {
    constructor() {}
  }

  class Resource extends Node {
    constructor() {
      super();
      this.type = 'Resource';
      this.body = [];
    }
  }

  class Entry extends Node {
    constructor() {
      super();
      this.type = 'Entry';
    }
  }

  class Identifier extends Node {
    constructor(name, namespace = null) {
      super();
      this.type = 'Identifier';
      this.name = name;
      this.namespace = namespace;
    }
  }

  class Section extends Node {
    constructor(name, comment = null) {
      super();
      this.type = 'Section';
      this.name = name;
      this.comment = comment;
    }
  }

  class Pattern$1 extends Node {
    constructor(source, elements) {
      super();
      this.type = 'Pattern';
      this.source = source;
      this.elements = elements;
    }
  }

  class Member extends Node {
    constructor(key, value, def = false) {
      super();
      this.type = 'Member';
      this.key = key;
      this.value = value;
      this.default = def;
    }
  }

  class Entity$1 extends Entry {
    constructor(id, value = null, traits = [], comment = null) {
      super();
      this.type = 'Entity';
      this.id = id;
      this.value = value;
      this.traits = traits;
      this.comment = comment;
    }
  }

  class Placeable extends Node {
    constructor(expressions) {
      super();
      this.type = 'Placeable';
      this.expressions = expressions;
    }
  }

  class SelectExpression$1 extends Node {
    constructor(expression, variants = null) {
      super();
      this.type = 'SelectExpression';
      this.expression = expression;
      this.variants = variants;
    }
  }

  class MemberExpression$1 extends Node {
    constructor(obj, keyword) {
      super();
      this.type = 'MemberExpression';
      this.object = obj;
      this.keyword = keyword;
    }
  }

  class CallExpression$1 extends Node {
    constructor(callee, args) {
      super();
      this.type = 'CallExpression';
      this.callee = callee;
      this.args = args;
    }
  }

  class ExternalArgument$1 extends Node {
    constructor(name) {
      super();
      this.type = 'ExternalArgument';
      this.name = name;
    }
  }

  class KeyValueArg$1 extends Node {
    constructor(name, value) {
      super();
      this.type = 'KeyValueArg';
      this.name = name;
      this.value = value;
    }
  }

  class EntityReference$1 extends Identifier {
    constructor(name, namespace) {
      super();
      this.type = 'EntityReference';
      this.name = name;
      this.namespace = namespace;
    }
  }

  class BuiltinReference$1 extends Identifier {
    constructor(name, namespace) {
      super();
      this.type = 'BuiltinReference';
      this.name = name;
      this.namespace = namespace;
    }
  }

  class Keyword extends Identifier {
    constructor(name, namespace=null) {
      super();
      this.type = 'Keyword';
      this.name = name;
      this.namespace = namespace;
    }
  }

  class Number extends Node {
    constructor(value) {
      super();
      this.type = 'Number';
      this.value = value;
    }
  }

  class TextElement extends Node {
    constructor(value) {
      super();
      this.type = 'TextElement';
      this.value = value;
    }
  }

  class Comment extends Node {
    constructor(content) {
      super();
      this.type = 'Comment';
      this.content = content;
    }
  }

  class JunkEntry extends Entry {
    constructor(content) {
      super();
      this.type = 'JunkEntry';
      this.content = content;
    }
  }

  var AST = {
    Node,
    Pattern: Pattern$1,
    Member,
    Identifier,
    Entity: Entity$1,
    Section,
    Resource,
    Placeable,
    SelectExpression: SelectExpression$1,
    MemberExpression: MemberExpression$1,
    CallExpression: CallExpression$1,
    ExternalArgument: ExternalArgument$1,
    KeyValueArg: KeyValueArg$1,
    Number,
    EntityReference: EntityReference$1,
    BuiltinReference: BuiltinReference$1,
    Keyword,
    TextElement,
    Comment,
    JunkEntry
  };

  class ParseContext$1 {
    constructor(string) {
      this._source = string;
      this._index = 0;
      this._length = string.length;

      this._lastGoodEntryEnd = 0;
    }

    getResource() {
      const resource = new AST.Resource();
      resource._errors = [];

      this.getWS();
      while (this._index < this._length) {
        try {
          resource.body.push(this.getEntry());
          this._lastGoodEntryEnd = this._index;
        } catch (e) {
          if (e instanceof L10nError) {
            resource._errors.push(e);
            resource.body.push(this.getJunkEntry());
          } else {
            throw e;
          }
        }
        this.getWS();
      }

      return resource;
    }

    getEntry() {
      if (this._index !== 0 &&
          this._source[this._index - 1] !== '\n') {
        throw this.error('Expected new line and a new entry');
      }

      let comment;

      if (this._source[this._index] === '#') {
        comment = this.getComment();
      }

      this.getLineWS();

      if (this._source[this._index] === '[') {
        return this.getSection(comment);
      }

      if (this._index < this._length &&
          this._source[this._index] !== '\n') {
        return this.getEntity(comment);
      }
      return comment;
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

      return new AST.Section(id, comment);
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

      return new AST.Entity(id, value, members, comment);
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

      return new AST.Identifier(id, namespace);
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

      return new AST.Identifier(id, namespace);
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
            content.push(new AST.TextElement(buffer));
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
        content.push(new AST.TextElement(buffer));
      }

      if (content.length === 0) {
        if (quoteDelimited !== null) {
          content.push(new AST.TextElement(source));
        } else {
          return null;
        }
      }

      let pattern = new AST.Pattern(source, content);
      pattern._quoteDelim = quoteDelimited !== null;
      return pattern;
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

      return new AST.Placeable(expressions);
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
      return new AST.SelectExpression(selector, members);
    }

    getCallExpression() {
      let exp = this.getMemberExpression();

      if (this._source[this._index] !== '(') {
        return exp;
      }

      this._index++;

      let args = this.getCallArgs();

      this._index++;

      if (exp instanceof AST.EntityReference) {
        exp = new AST.BuiltinReference(exp.name, exp.namespace);
      }

      return new AST.CallExpression(exp, args);
    }

    getCallArgs() {
      let args = [];

      if (this._source[this._index] === ')') {
        return args;
      }

      while (this._index < this._length) {
        this.getLineWS();

        let exp = this.getCallExpression();

        if (!(exp instanceof AST.EntityReference) ||
           exp.namespace !== null) {
          args.push(exp);
        } else {
          this.getLineWS();

          if (this._source[this._index] === ':') {
            this._index++;
            this.getLineWS();

            let val = this.getCallExpression();

            if (val instanceof AST.EntityReference ||
                val instanceof AST.MemberExpression) {
              this._index = this._source.lastIndexOf('=', this._index) + 1;
              throw this.error('Expected string in quotes');
            }

            args.push(new AST.KeyValueArg(exp.name, val));
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

      return new AST.Number(num);
    }

    getMemberExpression() {
      let exp = this.getLiteral();

      while (this._source[this._index] === '[') {
        let keyword = this.getKeyword();
        exp = new AST.MemberExpression(exp, keyword);
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

        let member = new AST.Member(key, value, def);

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
        literal = this.getIdentifierWithSpace('/');
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
        return new AST.ExternalArgument(id.name);
      }

      let id = this.getIdentifier('/');
      return new AST.EntityReference(id.name, id.namespace);
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

      return new AST.Comment(content);
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

      const junk = new AST.JunkEntry(
        this._source.slice(entityStart, nextEntity));
      return junk;
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

  var FTLASTParser = {
    parseResource: function(string) {
      const parseContext = new ParseContext$1(string);
      return parseContext.getResource();
    },
  };

  function toEntries([entries, curSection], entry) {
    if (entry.type === 'Section') {
      return [entries, entry.name.name];
    }

    if (curSection && !entry.id.namespace) {
      entry.id.namespace = curSection;
    }

    return [
      Object.assign(entries, {
        [stringifyIdentifier(entry.id)]: transformEntity(entry)
      }),
      curSection
    ];
  }

  function transformEntity(entity) {
    if (entity.traits.length === 0) {
      return transformPattern(entity.value);
    }

    const ret = {
      traits: entity.traits.map(transformMember),
    };

    if (entity.value !== null) {
      ret.val = transformPattern(entity.value);
    }

    return ret;
  }

  function transformExpression(exp) {
    if (exp instanceof AST.EntityReference) {
      return {
        type: 'ref',
        name: stringifyIdentifier(exp)
      };
    }
    if (exp instanceof AST.BuiltinReference) {
      return {
        type: 'blt',
        name: stringifyIdentifier(exp)
      };
    }
    if (exp instanceof AST.ExternalArgument) {
      return {
        type: 'ext',
        name: exp.name
      };
    }
    if (exp instanceof AST.Pattern) {
      return transformPattern(exp);
    }
    if (exp instanceof AST.Identifier) {
      return transformIdentifier(exp);
    }
    if (exp instanceof AST.Number) {
      return {
        type: 'num',
        val: exp.value
      };
    }
    if (exp instanceof AST.KeyValueArg) {
      return {
        type: 'kv',
        name: exp.name,
        val: transformExpression(exp.value)
      };
    }

    if (exp instanceof AST.SelectExpression) {
      return {
        type: 'sel',
        exp: transformExpression(exp.expression),
        vars: exp.variants.map(transformMember)
      };
    }
    if (exp instanceof AST.MemberExpression) {
      return {
        type: 'mem',
        obj: transformExpression(exp.object),
        key: transformExpression(exp.keyword)
      };
    }
    if (exp instanceof AST.CallExpression) {
      return {
        type: 'call',
        name: transformExpression(exp.callee),
        args: exp.args.map(transformExpression)
      };
    }
    return exp;
  }

  function transformPattern(pattern) {
    if (pattern === null) {
      return null;
    }

    if (pattern.elements.length === 1 &&
        pattern.elements[0] instanceof AST.TextElement) {
      return pattern.source;
    }

    return pattern.elements.map(chunk => {
      if (chunk instanceof AST.TextElement) {
        return chunk.value;
      }
      if (chunk instanceof AST.Placeable) {
        return chunk.expressions.map(transformExpression);
      }
      return chunk;
    });
  }

  function transformMember(member) {
    const type = member.key.type;
    const ret = {
      key: transformExpression(member.key),
      val: transformPattern(member.value),
    };

    if (member.default) {
      ret.def = true;
    }

    return ret;
  }

  function transformIdentifier(id) {
    const ret = {
      type: 'id',
      name: id.name
    };

    if (id.namespace) {
      ret.ns = id.namespace;
    }

    return ret;
  }

  function stringifyIdentifier(id) {
    if (id.namespace) {
      return `${id.namespace}/${id.name}`;
    }
    return id.name;
  }

  function createEntriesFromAST({body, _errors}) {
    const [entries] = body
      .filter(entry => entry.type === 'Entity' || entry.type === 'Section')
      .reduce(toEntries, [{}, null]);
    return {entries, _errors};
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
    fetchResource, Client, Remote, View, broadcast,
    FTLASTParser, FTLEntriesParser, createEntriesFromAST,
    Context, Env, L10nError, emit, addEventListener, removeEventListener,
    prioritizeLocales, MockContext, lang,
    walkEntry, walkValue, pseudo, format
  };

  return index;

}());