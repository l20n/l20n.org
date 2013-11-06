---
category: learn
layout: learn
title: "Defining the default variant"
---

<section class="clearfix">
	<div class="left">
		<p>One of the powerful paradigms of L20n is that ultimately every entity should evaluate to a single string, ready to be displayed in the UI.</p>
		<p>Dictionaries are multi-valued, so to work within this paradigm, we need a way to tell L20n which value to display if no specific member was requested.</p>
		<p>The asterisk <code>*</code> on a key does just that:  it denotes the default member to return in the absence of a more specific request.  In the <a href="{% post_url 2012-07-03-dictionary-values %}">previous chapter</a>, evaluating <code class="entity">name</code> resulted in an <code>IndexError</code>.  Now, with the default value defined via <code>*short</code>, <code class="entity">name</code> evaluates to "Loki".</p>
		<p>You can still reference any member of the dictionary explicitly, like it's done in the <code class="entity">license</code> entity below.</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height15"
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
	</div>
</section>

<section class="clearfix">
	<div class="left">
		<p>Keep in mind that dictionaries without default values are still valid L20n code and can be useful, especially as local data storages.  They cannot, however, be evaluated to a single string and used in the UI without some extra work.</p>
		<p>Naturally, dictionaries nested inside other dictionaries also can have default values.</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor2"
		  data-source="sourceEditor2"
		  data-output="output2"
		>&lt;name {
  *short: {
  	subjective: "Loki",
    *objective: "Loki",
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
