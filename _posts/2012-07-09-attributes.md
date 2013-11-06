---
category: learn
layout: learn
title: "Describing translations with custom data"
---

<section class="clearfix">
	<div class="left">
		<p>Attributes can be used to store additional information about entities.</p>
		<p>While entity values discussed in previous chapters store the representation of the entity to be displayed in the UI, it is sometimes useful to describe the entity with some meta-data:</p>
		<ul>
			<li>grammar meta-data, such as gender, animate vs. inanimate, etc.</li>
			<li>UI meta-data, such as tooltips, accesskeys, keyboard shortcuts, etc.</li>
		</ul>
		<p>Attributes come after the entity value and are defined with the name of the attribute, followed by a colon and a value.  You can reference attributes from other parts of the L20n code with the double-colon (<code>::</code>) syntax.</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
		>&lt;follow "Follow"
 accesskey: "F"
&gt;
&lt;unfollow "Unfollow"
 accesskey: "U"
&gt;
&lt;followHelp "To follow someone, press Ctrl+{% raw %}{{ follow::accesskey }}{% endraw %}"&gt;
&lt;unfollowHelp "To unfollow someone, press Ctrl+{% raw %}{{ unfollow::['accesskey'] }}{% endraw %}"&gt;
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>

<section class="clearfix">
	<div class="left">
		<p>Attribute values follow the exact same rules as entity values do:  they can be strings or dictionaries (also nested ones), and can define indexes and default values.</p>
		<p>See <a href="{% post_url 2012-07-14-globals-os %}">Chapter 14. "Adapting translations to user's operating system"</a> for a better way of implementing this.</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height25"
		  id="sourceEditor2"
		  data-source="sourceEditor2"
		  data-output="output2"
		>&lt;settings {
 *win: "Settings",
  mac: "Preferences"
 }
 accesskey: {
  *win: "S",
   mac: "P"
 }
&gt;
&lt;helpWin "To open Settings, press Ctrl+{% raw %}{{ settings::accesskey }}{% endraw %}"&gt;
&lt;helpMac "To open Preferences, press Cmd+{% raw %}{{ settings::accesskey.mac }}{% endraw %}"&gt;
		</div>
		<dl id="output2">
		</dl>
	</div>
</section>
