---
category: learn
layout: learn
title: String values
prev_section: hello-world
next_section: dictionary-values
---

L20n entities mostly store string values. A string is a sequence of characters that you can assign to an entity, store, and retrieve.

You can reference other entities in a string by using the double brace syntax, `{% raw %}{{ name }}{% endraw %}`.  The value of an entity called `name` will be retrieved and inserted into the `about` entity's value before it's returned by the context.

You can also define easy-to-read, multiline strings with triple quotes, as can be seen in the `description` entity.

<div id="editor" class="editor height15">&lt;name "Loki"&gt;
&lt;about "About {% raw %}{{ name }}{% endraw %}"&gt;
&lt;description """
  {% raw %}{{ name }}{% endraw %} is a simple micro-blogging
  app written entirely in HTML5.  It uses
  L20n to implement localization.
"""&gt;
</div>
<dl id="output">
</dl>