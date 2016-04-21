---
category: learn
layout: learn
title: "HTML Attributes"
---

<section class="clearfix">
	<div class="left">
    <p>Finally, traits can also be very useful when using L20n for localization
    of more complex UI elements, such as HTML components.</p>
    <p>Those elements often contain multiple translatable messages per one
    widget. For example, an HTML form input may have a value, but also a
    <code>placeholder</code> attribute, <code>aria-label</code> attribute and
    maybe a <code>title</code> attribute.</p>
    <p>Another example would be a Web Component confirm window with
    <code>ok</code>button , <code>cancel</code> button and a message.</p>
	</div>
  <div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
		>login-input = Predefined value
  [html/placeholder] example@email.com
  [html/aria-label]  Login input value
  [html/title]       Type your login email
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
