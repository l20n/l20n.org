---
category: learn
layout: learn
title: Default values for dictionaries
prev_section: dictionary-values
next_section: indexes-for-hash-tables
---

One of the powerful paradigms of L20n is that ultimately every entity should evaluate to a single string, ready to be displayed in the UI.

Dictionaries are multi-valued, so to work within this paradigm, we need a way to tell L20n which value to display if no specific member was requested.

The asterisk `*` on a key does just that:  it denotes the default member to return in the absence of a more specific request.  In the <a href="{% post_url 2012-07-03-dictionary-values %}">previous chapter</a>, evaluating `name` resulted in an `IndexError`.  Now, with the default value defined via `*short`, `name` evaluates to "Loki".

You can still reference any member of the dictionary explicitly, like it's done in the `license` entity below.

<div class="editor sourceEditor height5"
  id="sourceEditor1"
  data-source="sourceEditor1"
  data-output="output1"
>&lt;name {
 *short: "Loki",
  long: "Loki Mobile Client"
}&gt;
&lt;about "About {% raw %}{{ name }}{% endraw %}"&gt;
&lt;license "{% raw %}{{ name.short }}{% endraw %} is open-source."&gt;
</div>
<dl id="output1">
</dl>

Keep in mind that dictionaries without default values are still valid L20n code and can be useful, especially as local data stores.  They cannot, however, be evaluated to a single string and used in the UI without some extra work.

Naturally, dictionaries nested inside other dictionaries also can have default values.

<div class="editor sourceEditor height5"
  id="sourceEditor2"
  data-source="sourceEditor2"
  data-output="output2"
>&lt;name {
  *short: {
    *nominative: "Loki",
    genitive: "Loki's"
  },
  long: "Loki Mobile Client"
}&gt;
&lt;about "About {% raw %}{{ name.short.nominative }}{% endraw %}"&gt;
&lt;license "{% raw %}{{ name.long }}{% endraw %} is open-source."&gt;
</div>
<dl id="output2">
</dl>
