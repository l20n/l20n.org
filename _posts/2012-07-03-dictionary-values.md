---
category: learn
layout: learn
title: Dictionary values
prev_section: string-values
next_section: default-values-for-dictionaries
---

Sometimes you might want to store more than one variant of the same entity.  Maybe you want to have one variant for the masculine gender, and another for the feminine one.  Or maybe your string uses a number and you need a few variants, each for one plural form.

Enter dictionary values.  Dictionaries are the second value type an entity can have.  They associate a key (e.g., `short`) with a value (e.g., `Loki`).  The value of the key is often called a member.

You can access the values in a dictionary by using a single dot syntax (`name.short`) or by using the square bracket syntax (`name['long']`) should you need to compute the member's key on runtime.
(You'll learn how to prevent the `IndexError` in `name` in the <a href="{% post_url 2012-07-04-default-values-for-dictionaries %}">next chapter</a>.)

<div id="editor1" class="editor height15">&lt;name {
  short: "Loki",
  long: "Loki Mobile Client"
}&gt;
&lt;about "About {% raw %}{{ name.short }}{% endraw %}"&gt;
&lt;license "{% raw %}{{ name['long'] }}{% endraw %} is open-source."&gt;
</div>
<dl id="output">
</dl>

Dictionaries can be nested and mixed with regular strings.

<div id="editor2" class="editor height15">&lt;name {
  short: {
    nominative: "Loki",
    genitive: "Loki's"
  },
  long: "Loki Mobile Client"
&gt;
&lt;about "About {% raw %}{{ name.short.nominative }}{% endraw %}"&gt;
&lt;license "{% raw %}{{ name.long }}{% endraw %} is open-source."&gt;
</div>
<dl id="output">
</dl>