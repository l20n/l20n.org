---
category: learn
layout: learn
title: "Choosing one variant"
---

<section class="clearfix">
	<div class="left">
		<p>The asterisk <code>*</code> syntax is short-hand for a specific use in another of L20n's features: indexes.</p>
		<p>When the entity's value is a dictionary, an index (<code>["short"]</code> below) can be added to it to indicate which key of the dictionary should be returned.</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
		>&lt;name["short"] {
  short: "Loki",
  long: "Loki Mobile Client"
}&gt;
&lt;about "About {% raw %}{{ name }}{% endraw %}"&gt;
&lt;licensing "{% raw %}{{ name.long }}{% endraw %} is both free and open-source."&gt;
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>

<section class="clearfix">
	<div class="left">
		<p>You can get much more creative in indexes and put expressions in them, too (see <a href="{% post_url 2012-07-12-expressions %}">Chapter 12. "Building macros and expressions"</a>).</p>
		<p>If you nest dictionaries, you can define multivalued indexes.</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor2"
		  data-source="sourceEditor2"
		  data-output="output2"
		>&lt;name["short", "objective"] {
  short: {
    subjective: "Loki",
    objective: "Loki",
    possessive: "Loki's"
  },
  long: "Loki Mobile Client"
}&gt;
&lt;about "About {% raw %}{{ name.short.objective }}{% endraw %}"&gt;
&lt;license "{% raw %}{{ name.long }}{% endraw %} is open-source."&gt;
		</div>
		<dl id="output2">
		</dl>
	</div>
</section>
