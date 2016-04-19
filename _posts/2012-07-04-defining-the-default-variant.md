---
category: learn
layout: learn
---

<section class="clearfix">
	<div class="left">
		<p>One of the powerful paradigms of L20n is that ultimately every entity should evaluate to a single string, ready to be displayed in the UI.</p>
		<p>Entities with variants have multiple values, so to work within this
    paradigm, we need a way to tell L20n which variant to display if no specific member was requested.</p>
		<p>The asterisk <code>*</code> on a key does just that:  it denotes the
    default member to return in the absence of a more specific request.  In the
    <a href="{% post_url 2012-07-03-translations-with-multiple-variants
    %}">previous chapter</a>, evaluating <code class="entity">name</code>
    resulted in an <code>IndexError</code>.  Now, with the default value
    defined via <code>*[short]</code>, <code class="entity">name</code> evaluates to "Loki".</p>
		<p>You can still reference any member of the dictionary explicitly, like it's done in the <code class="entity">license</code> entity below.</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
		>name =
 *[short] Loki
  [long] Loki Mobile Client

about = About {% raw %}{ name }{% endraw %}
license = {% raw %}{ name[short] }{% endraw %} is open-source.
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>

<section class="clearfix">
	<div class="left">
		<p>Naturally, variants nested inside other variants also can have default values.</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor2"
		  data-source="sourceEditor2"
		  data-output="output2"
		>name =
  *[short]
  	[subjective] Loki
   *[objective] Loki
    [possessive] Loki's
  [long] Loki Mobile Client

about = About {% raw %}{ name[short][objective] }{% endraw %}
license = {% raw %}{ name[long] }{% endraw %} is open-source.
		</div>
		<dl id="output2">
		</dl>
	</div>
</section>
