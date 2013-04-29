---
category: learn
layout: learn
title: Dictionary values
prev_section: string-values
next_section: default-values-for-dictionaries
---

<section class="clearfix">
	<div class="left">
		<p>Sometimes you might want to store more than one variant of the same entity.  Maybe you want to have one variant for the masculine gender, and another for the feminine one.  Or maybe your string uses a number and you need a few variants, each for one plural form.</p>
		<p>Enter dictionary values.  Dictionaries are the second value type an entity can have.  They associate a key (e.g., <code>short</code>) with a value (e.g., <code>Loki</code>).  The value of the key is often called a member.</p>
		<p>You can access the values in a dictionary by using a single dot syntax (<code>name.short</code>) or by using the square bracket syntax (<code>name['long']</code>) should you need to compute the member's key on runtime.
(You'll learn how to prevent the <code>IndexError</code> in <code>name</code> in the <a href="{% post_url 2012-07-04-default-values-for-dictionaries %}">next chapter</a>.)</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
		>&lt;name {
  short: "Loki",
  long: "Loki Mobile Client"
}&gt;
&lt;about "About {% raw %}{{ name.short }}{% endraw %}"&gt;
&lt;license "{% raw %}{{ name['long'] }}{% endraw %} is open-source."&gt;
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>

<section class="clearfix">
	<div class="left">
		<p>Dictionaries can be nested and mixed with regular strings.</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor2"
		  data-source="sourceEditor2"
		  data-output="output2"
		>&lt;name {
  short: {
    nominative: "Loki",
    genitive: "Loki's"
  },
  long: "Loki Mobile Client"
}&gt;
&lt;about "About {% raw %}{{ name.short.nominative }}{% endraw %}"&gt;
&lt;license "{% raw %}{{ name.long }}{% endraw %} is open-source."&gt;
		</div>
		<dl id="output2">
		</dl>
	</div>
</section>
