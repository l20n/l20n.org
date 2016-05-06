var L20n = (function () {
  'use strict';

  class L10nError extends Error {
    constructor(message, id, lang) {
      super();
      this.name = 'L10nError';
      this.message = message;
      this.id = id;
      this.lang = lang;
    }
  }

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
      return () => 'other';
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

  class FTLBase {
    constructor(value, opts) {
      this.value = value;
      this.opts = opts;
    }
    valueOf() {
      return this.value;
    }
  }

  class FTLNumber extends FTLBase {
    constructor(value, opts) {
      super(parseFloat(value), opts);
    }
    toString(rc) {
      const nf = rc.ctx._memoizeIntlObject(
        L20nIntl.NumberFormat, rc.lang, this.opts
      );
      return nf.format(this.value);
    }
  }

  class FTLDateTime extends FTLBase {
    constructor(value, opts) {
      super(new Date(value), opts);
    }
    toString(rc) {
      const dtf = rc.ctx._memoizeIntlObject(
        L20nIntl.DateTimeFormat, rc.lang, this.opts
      );
      return dtf.format(this.value);
    }
  }

  class FTLKeyword extends FTLBase {
    toString() {
      const { name, namespace } = this.value;
      return namespace ? `${namespace}:${name}` : name;
    }
    match(rc, other) {
      const { name, namespace } = this.value;
      if (other instanceof FTLKeyword) {
        return name === other.value.name && namespace === other.value.namespace;
      } else if (namespace) {
        return false;
      } else if (typeof other === 'string') {
        return name === other;
      } else if (other instanceof FTLNumber) {
        const pr = rc.ctx._memoizeIntlObject(
          L20nIntl.PluralRules, rc.lang, other.opts
        );
        return name === pr.select(other.valueOf());
      }
    }
  }

  class FTLList extends Array {
    constructor(arr = [], opts) {
      super(arr.length);
      this.opts = opts;
      for (let [index, elem] of arr.entries()) {
        this[index] = elem;
      }
    }
    toString(rc) {
      const lf = rc.ctx._memoizeIntlObject(
        L20nIntl.ListFormat, rc.lang, this.opts
      );
      const elems = this.map(
        elem => elem.toString(rc)
      );
      return lf.format(elems);
    }
    concat(elem) {
      return new FTLList([...this, elem]);
    }
  }

  // each builtin takes two arguments:
  //  - args = an array of positional args
  //  - opts  = an object of key-value args

  var builtins = {
    'NUMBER': ([arg], opts) => new FTLNumber(arg.valueOf(), valuesOf(opts)),
    'PLURAL': ([arg], opts) => new FTLNumber(arg.valueOf(), valuesOf(opts)),
    'DATETIME': ([arg], opts) => new FTLDateTime(arg.valueOf(), valuesOf(opts)),
    'LIST': (args) => new FTLList(args),
    'LEN': ([arg], opts) => new FTLNumber(arg.valueOf().length, valuesOf(opts)),
    'TAKE': ([num, arg], opts) =>
      new FTLList(arg.value.slice(0, num.value), valuesOf(opts)),
    'DROP': ([num, arg], opts) =>
      new FTLList(arg.value.slice(num.value), valuesOf(opts)),
  };

  function valuesOf(opts) {
    return Object.keys(opts).reduce(
      (seq, cur) => Object.assign({}, seq, {
        [cur]: opts[cur].valueOf()
      }), {});
  }

  // Unicode bidi isolation characters
  const FSI = '\u2068';
  const PDI = '\u2069';

  const MAX_PLACEABLE_LENGTH = 2500;

  function mapValues(rc, arr) {
    return arr.reduce(
      ([valseq, errseq], cur) => {
        const [value, errs] = Value(rc, cur);
        return [valseq.concat(value), errseq.concat(errs)];
      }, [new FTLList(), []]
    );
  }

  function unit(val) {
    return [val, []];
  }

  function fail(val, err) {
    return [val, [err]];
  }

  function flat([val, errs2], errs1) {
    return [val, [...errs1, ...errs2]];
  }


  // Helper for choosing entity value

  function DefaultMember(members) {
    for (let member of members) {
      if (member.def) {
        return unit(member);
      }
    }

    return fail('???', new L10nError('No default'));
  }


  // Half-resolved expressions

  function Expression(rc, expr) {
    switch (expr.type) {
      case 'ref':
        return EntityReference(rc, expr);
      case 'blt':
        return BuiltinReference(rc, expr);
      case 'mem':
        return MemberExpression(rc, expr);
      case 'sel':
        return SelectExpression(rc, expr);
      default:
        return unit(expr);
    }
  }

  function EntityReference(rc, expr) {
    const entity = rc.ctx._getEntity(rc.lang, expr.name);

    if (!entity) {
      return fail(expr.name, new L10nError('Unknown entity: ' + expr.name));
    }

    return unit(entity);
  }

  function BuiltinReference(rc, expr) {
    const builtin = builtins[expr.name];

    if (!builtin) {
      return fail(
        expr.name + '()', new L10nError('Unknown built-in: ' + expr.name + '()')
      );
    }

    return unit(builtin);
  }

  function MemberExpression(rc, expr) {
    const [entity, errs] = Expression(rc, expr.obj);
    if (errs.length) {
      return [entity, errs];
    }

    const [key] = Value(rc, expr.key);

    for (let member of entity.traits) {
      const [memberKey] = Value(rc, member.key);
      if (key.match(rc, memberKey)) {
        return unit(member);
      }
    }

    return fail(entity, new L10nError('Unknown trait: ' + key.toString(rc)));
  }

  function SelectExpression(rc, expr) {
    const [selector, errs] = Value(rc, expr.exp);
    if (errs.length) {
      return flat(DefaultMember(expr.vars), errs);
    }

    for (let variant of expr.vars) {
      const [key] = Value(rc, variant.key);

      if (key instanceof FTLNumber &&
          selector instanceof FTLNumber &&
          key.valueOf() === selector.valueOf()) {
        return unit(variant);
      }

      if (key instanceof FTLKeyword &&
          key.match(rc, selector)) {
        return unit(variant);
      }
    }

    return DefaultMember(expr.vars);
  }


  // Fully-resolved expressions

  function Value(rc, expr) {
    if (typeof expr === 'string' || expr === null) {
      return unit(expr);
    }

    if (Array.isArray(expr)) {
      return Pattern(rc, expr);
    }

    const [node, errs] = Expression(rc, expr);
    if (errs.length) {
      // Expression short-circuited into a simple string or a fallback
      return flat(Value(rc, node), errs);
    }

    switch (node.type) {
      case 'kw':
        return [new FTLKeyword(node), errs];
      case 'num':
        return [new FTLNumber(node.val), errs];
      case 'ext':
        return flat(ExternalArgument(rc, node), errs);
      case 'call':
        return flat(CallExpression(rc, expr), errs);
      default:
        return node.key ? // is it a Member?
          flat(Value(rc, node.val), errs) :
          flat(Entity(rc, node), errs);
    }
  }

  function ExternalArgument(rc, expr) {
    const name = expr.name;
    const args = rc.args;

    if (!args || !args.hasOwnProperty(name)) {
      return fail(name, new L10nError('Unknown external: ' + name));
    }

    const arg = args[name];

    switch (typeof arg) {
      case 'string':
        return unit(arg);
      case 'number':
        return unit(new FTLNumber(arg));
      case 'object':
        if (Array.isArray(arg)) {
          return mapValues(rc, arg);
        }
        if (arg instanceof Date) {
          return unit(new FTLDateTime(arg));
        }
      default:
        return fail(name, new L10nError(
          'Unsupported external type: ' + name + ', ' + typeof arg
        ));
    }
  }

  function CallExpression(rc, expr) {
    const [callee, errs1] = Expression(rc, expr.name);
    if (errs1.length) {
      return [callee, errs1];
    }

    const [pargs, kargs, errs2] = expr.args.reduce(
      ([pargseq, kargseq, errseq], arg) => {
        if (arg.type === 'kv') {
          const [val, errs] = Value(rc, arg.val);
          kargseq[arg.name] = val;
          return [pargseq, kargseq, [...errseq, ...errs]];
        } else {
          const [val, errs] = Value(rc, arg);
          return [[...pargseq, val], kargseq, [...errseq, ...errs]];
        }
      }, [[], {}, []]);
    return [callee(pargs, kargs), errs2];
  }

  function Pattern(rc, ptn) {
    if (rc.dirty.has(ptn)) {
      return fail('???', new L10nError('Cyclic reference'));
    }

    rc.dirty.add(ptn);

    const rv = ptn.reduce(([valseq, errseq], elem) => {
      if (typeof elem === 'string') {
        return [valseq + elem, errseq];
      } else {
        const [value, errs] = elem.length === 1 ?
          Value(rc, elem[0]) : mapValues(rc, elem);
        const str = value.toString(rc);
        if (str.length > MAX_PLACEABLE_LENGTH) {
          return [
            valseq + '???',
            [...errseq, ...errs, new L10nError(
              'Too many characters in placeable ' +
              `(${str.length}, max allowed is ${MAX_PLACEABLE_LENGTH})`
            )]
          ];
        }
        return [
          valseq + FSI + str + PDI, [...errseq, ...errs],
        ];
      }

    }, ['', []]);

    rc.dirty.delete(ptn);
    return rv;
  }

  function Entity(rc, entity) {
    if (!entity.traits) {
      return Value(rc, entity);
    }

    if (entity.val !== undefined) {
      return Value(rc, entity.val);
    }

    const [def, errs] = DefaultMember(entity.traits);
    return flat(Value(rc, def), errs);
  }


  function format(ctx, lang, args, entity) {
    // rc is the current resolution context
    const rc = {
      ctx,
      lang,
      args,
      dirty: new WeakSet()
    };

    return Value(rc, entity);
  }

  class Context {
    constructor(env, langs, resIds) {
      this.langs = langs;
      this.resIds = resIds;
      this.env = env;
      this.emit = (type, evt) => env.emit(type, evt, this);
    }

    _formatEntity(lang, args, entity) {
      const [value] = format(this, lang, args, entity);

      const formatted = {
        value,
        attrs: null,
      };

      if (entity.traits) {
        formatted.attrs = Object.create(null);
        for (let trait of entity.traits) {
          const [attrValue] = format(this, lang, args, trait);
          formatted.attrs[trait.key.name] = attrValue;
        }
      }

      return formatted;
    }

    _formatValue(lang, args, entity) {
      const [value] = format(this, lang, args, entity);
      return value;
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
          return formatter.call(this, lang, args, entity);
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
        if (name in resource) {
          return resource[name];
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
    }

    getResource() {
      const entries = {};
      const errors = [];

      this.getWS();
      while (this._index < this._length) {
        try {
          const entry = this.getEntry();
          if (!entry) {
            this.getWS();
            continue;
          }

          const id = entry.id;
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

      return [entries, errors];
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

    getSection() {
      this._index += 1;
      if (this._source[this._index] !== '[') {
        throw this.error('Expected "[[" to open a section');
      }

      this._index += 1;

      this.getLineWS();
      this.getKeyword();
      this.getLineWS();

      if (this._source[this._index] !== ']' ||
          this._source[this._index + 1] !== ']') {
        throw this.error('Expected "]]" to close a section');
      }

      this._index += 2;

      // sections are ignored in the runtime ast
      return undefined;
    }

    getEntity() {
      const id = this.getIdentifier();

      let traits = null;
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
        traits = this.getMembers();
      } else if (value === null) {
        throw this.error(
          `Expected a value (like: " = value") or a trait (like: "[key] value")`
        );
      }

      return {
        id,
        value,
        traits
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

    getIdentifier() {
      let name = '';

      const start = this._index;
      let cc = this._source.charCodeAt(this._index);

      if ((cc >= 97 && cc <= 122) || // a-z
          (cc >= 65 && cc <= 90) ||  // A-Z
          cc === 95) {               // _
        cc = this._source.charCodeAt(++this._index);
      } else if (name.length === 0) {
        throw this.error('Expected an identifier (starting with [a-zA-Z_])');
      }

      while ((cc >= 97 && cc <= 122) || // a-z
             (cc >= 65 && cc <= 90) ||  // A-Z
             (cc >= 48 && cc <= 57) ||  // 0-9
             cc === 95 || cc === 45) {  // _-
        cc = this._source.charCodeAt(++this._index);
      }

      name += this._source.slice(start, this._index);

      return name;
    }

    getKeyword() {
      let name = '';
      let namespace = this.getIdentifier();

      if (this._source[this._index] === '/') {
        this._index++;
      } else if (namespace) {
        name = namespace;
        namespace = null;
      }

      const start = this._index;
      let cc = this._source.charCodeAt(this._index);

      if ((cc >= 97 && cc <= 122) || // a-z
          (cc >= 65 && cc <= 90) ||  // A-Z
          cc === 95 || cc === 32) {  //  _
        cc = this._source.charCodeAt(++this._index);
      } else if (name.length === 0) {
        throw this.error('Expected an identifier (starting with [a-zA-Z_])');
      }

      while ((cc >= 97 && cc <= 122) || // a-z
             (cc >= 65 && cc <= 90) ||  // A-Z
             (cc >= 48 && cc <= 57) ||  // 0-9
             cc === 95 || cc === 45 || cc === 32) {  //  _-
        cc = this._source.charCodeAt(++this._index);
      }

      name += this._source.slice(start, this._index).trimRight();

      return namespace ?
        { type: 'kw', ns: namespace, name } :
        { type: 'kw', name };
    }

    getPattern() {
      const start = this._index;
      if (this._source[start] === '"') {
        return this.getComplexPattern();
      }
      let eol = this._source.indexOf('\n', this._index);

      if (eol === -1) {
        eol = this._length;
      }

      const line = this._source.slice(start, eol);

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
      const content = [];
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
          const ch2 = this._source[this._index + 1];
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
          buffer = ''
          content.push(this.getPlaceable());
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
        content.push(buffer);
      }

      if (content.length === 0) {
        if (quoteDelimited !== null) {
          return '';
        } else {
          return null;
        }
      }

      if (content.length === 1 &&
          typeof content[0] === 'string') {
        return content[0];
      }

      return content;
    }

    getPlaceable() {
      this._index++;

      const expressions = [];

      this.getLineWS();

      while (this._index < this._length) {
        const start = this._index;
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
      const selector = this.getCallExpression();
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
      const exp = this.getMemberExpression();

      if (this._source[this._index] !== '(') {
        return exp;
      }

      this._index++;

      const args = this.getCallArgs();

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
      const args = [];

      if (this._source[this._index] === ')') {
        return args;
      }

      while (this._index < this._length) {
        this.getLineWS();

        const exp = this.getCallExpression();

        if (exp.type !== 'ref' ||
           exp.namespace !== undefined) {
          args.push(exp);
        } else {
          this.getLineWS();

          if (this._source[this._index] === ':') {
            this._index++;
            this.getLineWS();

            const val = this.getCallExpression();

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
        const keyword = this.getMemberKey();
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

        const key = this.getMemberKey();

        this.getLineWS();

        const value = this.getPattern();

        const member = {
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

    getMemberKey() {
      this._index++;

      const cc = this._source.charCodeAt(this._index);
      let literal;

      if ((cc >= 48 && cc <= 57) || cc === 45) {
        literal = this.getNumber();
      } else {
        literal = this.getKeyword();
      }

      if (this._source[this._index] !== ']') {
        throw this.error('Expected "]"');
      }

      this._index++;
      return literal;
    }

    getLiteral() {
      const cc = this._source.charCodeAt(this._index);
      if ((cc >= 48 && cc <= 57) || cc === 45) {
        return this.getNumber();
      } else if (cc === 34) { // "
        return this.getPattern();
      } else if (cc === 36) { // $
        this._index++;
        return {
          type: 'ext',
          name: this.getIdentifier()
        };
      }

      return {
        type: 'ref',
        name: this.getIdentifier()
      };
    }

    getComment() {
      let eol = this._source.indexOf('\n', this._index);

      while (eol !== -1 && this._source[eol + 1] === '#') {
        this._index = eol + 2;

        eol = this._source.indexOf('\n', this._index);

        if (eol === -1) {
          break;
        }
      }

      if (eol === -1) {
        this._index = this._length;
      } else {
        this._index = eol + 1;
      }
    }

    error(message, start=null) {
      const pos = this._index;

      if (start === null) {
        start = pos;
      }
      start = this._findEntityStart(start);

      const context = this._source.slice(start, pos + 10);

      const msg = '\n\n  ' + message +
        '\nat pos ' + pos + ':\n------\n…' + context + '\n------';
      const err = new L10nError(msg);

      const row = this._source.slice(0, pos).split('\n').length;
      const col = pos - this._source.lastIndexOf('\n', pos - 1);
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
        const cc = this._source.charCodeAt(start + 1);

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
          const cc = this._source.charCodeAt(start);

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
        const [entries] = this._parse(syntax, lang, data);
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
    constructor(body = [], comment = null) {
      super();
      this.type = 'Resource';
      this.body = body;
      this.comment = comment;
    }
  }

  class Entry extends Node {
    constructor() {
      super();
      this.type = 'Entry';
    }
  }

  class Identifier extends Node {
    constructor(name) {
      super();
      this.type = 'Identifier';
      this.name = name;
    }
  }

  class Section extends Node {
    constructor(key, body = [], comment = null) {
      super();
      this.type = 'Section';
      this.key = key;
      this.body = body;
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

  class KeyValueArg extends Node {
    constructor(name, value) {
      super();
      this.type = 'KeyValueArg';
      this.name = name;
      this.value = value;
    }
  }

  class EntityReference$1 extends Identifier {
    constructor(name) {
      super(name);
      this.type = 'EntityReference';
    }
  }

  class BuiltinReference$1 extends Identifier {
    constructor(name) {
      super(name);
      this.type = 'BuiltinReference';
    }
  }

  class Keyword extends Identifier {
    constructor(name, namespace=null) {
      super(name);
      this.type = 'Keyword';
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
    KeyValueArg,
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
      this._currentBlock = null;
    }

    _isIdentifierStart(cc) {
      return ((cc >= 97 && cc <= 122) || // a-z
              (cc >= 65 && cc <= 90) ||  // A-Z
               cc === 95);               // _
    }

    getResource() {
      const resource = new AST.Resource();
      const errors = [];
      let comment = null;

      this._currentBlock = resource.body;

      if (this._source[this._index] === '#') {
        comment = this.getComment();

        const cc = this._source.charCodeAt(this._index);
        if (!this._isIdentifierStart(cc)) {
          resource.comment = comment;
          comment = null;
        }
      }

      this.getWS();
      while (this._index < this._length) {
        try {
          this._currentBlock.push(this.getEntry(comment));
          this._lastGoodEntryEnd = this._index;
          comment = null;
        } catch (e) {
          if (e instanceof L10nError) {
            errors.push(e);
            this._currentBlock.push(this.getJunkEntry());
          } else {
            throw e;
          }
        }
        this.getWS();
      }

      return [resource, errors];
    }

    getEntry(comment = null) {
      if (this._index !== 0 &&
          this._source[this._index - 1] !== '\n') {
        throw this.error('Expected new line and a new entry');
      }

      if (comment === null && this._source[this._index] === '#') {
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

      const key = this.getKeyword();

      this.getLineWS();

      if (this._source[this._index] !== ']' ||
          this._source[this._index + 1] !== ']') {
        throw this.error('Expected "]]" to close a section');
      }

      this._index += 2;

      const section = new AST.Section(key, [], comment);
      this._currentBlock = section.body;
      return section;
    }

    getEntity(comment = null) {
      const id = this.getIdentifier();

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

    getIdentifier() {
      let name = '';

      const start = this._index;
      let cc = this._source.charCodeAt(this._index);

      if (this._isIdentifierStart(cc)) {
        cc = this._source.charCodeAt(++this._index);
      } else if (name.length === 0) {
        throw this.error('Expected an identifier (starting with [a-zA-Z_])');
      }

      while ((cc >= 97 && cc <= 122) || // a-z
             (cc >= 65 && cc <= 90) ||  // A-Z
             (cc >= 48 && cc <= 57) ||  // 0-9
             cc === 95 || cc === 45) {  // _-
        cc = this._source.charCodeAt(++this._index);
      }

      name += this._source.slice(start, this._index);

      return new AST.Identifier(name);
    }

    getKeyword() {
      let name = '';
      let namespace = this.getIdentifier().name;

      if (this._source[this._index] === '/') {
        this._index++;
      } else if (namespace) {
        name = namespace;
        namespace = null;
      }

      const start = this._index;
      let cc = this._source.charCodeAt(this._index);

      if (this._isIdentifierStart(cc)) {
        cc = this._source.charCodeAt(++this._index);
      } else if (name.length === 0) {
        throw this.error('Expected an identifier (starting with [a-zA-Z_])');
      }

      while ((cc >= 97 && cc <= 122) || // a-z
             (cc >= 65 && cc <= 90) ||  // A-Z
             (cc >= 48 && cc <= 57) ||  // 0-9
             cc === 95 || cc === 45 || cc === 32) {  //  _-
        cc = this._source.charCodeAt(++this._index);
      }

      name += this._source.slice(start, this._index).trimRight();

      return new AST.Keyword(name, namespace);
    }

    getPattern() {
      let buffer = '';
      let source = '';
      const content = [];
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
          const ch2 = this._source[this._index + 1];
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
          const start = this._index;
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

      const pattern = new AST.Pattern(source, content);
      pattern._quoteDelim = quoteDelimited !== null;
      return pattern;
    }

    getPlaceable() {
      this._index++;

      const expressions = [];

      this.getLineWS();

      while (this._index < this._length) {
        const start = this._index;
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
      const selector = this.getCallExpression();
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

      const args = this.getCallArgs();

      this._index++;

      if (exp instanceof AST.EntityReference) {
        exp = new AST.BuiltinReference(exp.name);
      }

      return new AST.CallExpression(exp, args);
    }

    getCallArgs() {
      const args = [];

      if (this._source[this._index] === ')') {
        return args;
      }

      while (this._index < this._length) {
        this.getLineWS();

        const exp = this.getCallExpression();

        if (!(exp instanceof AST.EntityReference)) {
          args.push(exp);
        } else {
          this.getLineWS();

          if (this._source[this._index] === ':') {
            this._index++;
            this.getLineWS();

            const val = this.getCallExpression();

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
        const keyword = this.getMemberKey();
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

        const key = this.getMemberKey();

        this.getLineWS();

        const value = this.getPattern();

        const member = new AST.Member(key, value, def);

        members.push(member);

        this.getWS();
      }

      return members;
    }

    getMemberKey() {
      this._index++;

      const cc = this._source.charCodeAt(this._index);
      let literal;

      if ((cc >= 48 && cc <= 57) || cc === 45) {
        literal = this.getNumber();
      } else {
        literal = this.getKeyword();
      }

      if (this._source[this._index] !== ']') {
        throw this.error('Expected "]"');
      }

      this._index++;
      return literal;
    }

    getLiteral() {
      const cc = this._source.charCodeAt(this._index);
      if ((cc >= 48 && cc <= 57) || cc === 45) {
        return this.getNumber();
      } else if (cc === 34) { // "
        return this.getPattern();
      } else if (cc === 36) { // $
        this._index++;
        const name = this.getIdentifier().name;
        return new AST.ExternalArgument(name);
      }

      const name = this.getIdentifier().name;
      return new AST.EntityReference(name);
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
      const pos = this._index;

      if (start === null) {
        start = pos;
      }
      start = this._findEntityStart(start);

      const context = this._source.slice(start, pos + 10);

      const msg = '\n\n  ' + message +
        '\nat pos ' + pos + ':\n------\n…' + context + '\n------';
      const err = new L10nError(msg);

      const row = this._source.slice(0, pos).split('\n').length;
      const col = pos - this._source.lastIndexOf('\n', pos - 1);
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
        const cc = this._source.charCodeAt(start + 1);

        if (this._isIdentifierStart(cc)) {
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
          const cc = this._source.charCodeAt(start);

          if (this._isIdentifierStart(cc) || cc === 35 || cc === 91) {
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

  function transformEntity(entity) {
    if (entity.traits.length === 0) {
      return transformPattern(entity.value);
    }

    const ret = {
      traits: entity.traits.map(transformMember),
    };

    return entity.value !== null ?
      Object.assign(ret, { val: transformPattern(entity.value) }) :
      ret;
  }

  function transformExpression(exp) {
    switch (exp.type) {
      case 'EntityReference':
        return {
          type: 'ref',
          name: exp.name
        };
      case 'BuiltinReference':
        return {
          type: 'blt',
          name: exp.name
        };
      case 'ExternalArgument':
        return {
          type: 'ext',
          name: exp.name
        };
      case 'Pattern':
        return transformPattern(exp);
      case 'Number':
        return {
          type: 'num',
          val: exp.value
        };
      case 'Keyword':
        const kw = {
          type: 'kw',
          name: exp.name
        };

        return exp.namespace ?
          Object.assign(kw, { ns: exp.namespace }) :
          kw;
      case 'KeyValueArg':
        return {
          type: 'kv',
          name: exp.name,
          val: transformExpression(exp.value)
        };
      case 'SelectExpression':
        return {
          type: 'sel',
          exp: transformExpression(exp.expression),
          vars: exp.variants.map(transformMember)
        };
      case 'MemberExpression':
        return {
          type: 'mem',
          obj: transformExpression(exp.object),
          key: transformExpression(exp.keyword)
        };
      case 'CallExpression':
        return {
          type: 'call',
          name: transformExpression(exp.callee),
          args: exp.args.map(transformExpression)
        };
      default:
        return exp;
    }
  }

  function transformPattern(pattern) {
    if (pattern === null) {
      return null;
    }

    if (pattern.elements.length === 1 &&
        pattern.elements[0].type === 'TextElement') {
      return pattern.source;
    }

    return pattern.elements.map(chunk => {
      if (chunk.type === 'TextElement') {
        return chunk.value;
      }
      if (chunk.type === 'Placeable') {
        return chunk.expressions.map(transformExpression);
      }
      return chunk;
    });
  }

  function transformMember(member) {
    const ret = {
      key: transformExpression(member.key),
      val: transformPattern(member.value),
    };

    if (member.default) {
      ret.def = true;
    }

    return ret;
  }

  function getEntitiesFromBody(body) {
    const entities = {};
    body.forEach(entry => {
      if (entry.type === 'Entity') {
        entities[entry.id.name] = transformEntity(entry);
      } else if (entry.type === 'Section') {
        Object.assign(entities, getEntitiesFromBody(entry.body));
      }
    });
    return entities;
  }

  function createEntriesFromAST([resource, errors]) {
    const entities = getEntitiesFromBody(resource.body);
    return [entities, errors];
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