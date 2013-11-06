---
category: learn
layout: learn
title: "2. Working with text: multiline, interpolation"
---

<section class="clearfix">
	<div class="left">
		<p>L20n entities mostly store string values. A string is a sequence of characters that you can assign to an entity, store, and retrieve.</p>
		<p>You can reference other entities in a string by using the double brace syntax <code>{% raw %}{{ name }}{% endraw %}</code>.  The value of an entity called <code class="entity">name</code> will be retrieved and inserted into the <code class="entity">about</code> entity's value before it's returned by the context.</p>
		<p>You can also define easy-to-read, multiline strings with triple quotes, as can be seen in the <code class="entity">description</code> entity.</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
		>&lt;name "Loki"&gt;
&lt;about "About {% raw %}{{ name }}{% endraw %}"&gt;
&lt;description """
  {% raw %}{{ name }}{% endraw %} is a simple micro-blogging
  app written entirely in HTML5.  It uses
  L20n to implement localization.
"""&gt;
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
