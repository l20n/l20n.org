---
category: learn
layout: learn
title: "Working With Text: Multiline, Quote Delimited Strings"
---

<section class="clearfix">
	<div class="left">
		<p>L20n entities mostly store string values. A string is a sequence of characters that you can assign to an entity, store, and retrieve.</p>
    <p>By default, a string begins after a code character like <code>=</code>
    and ends with the end of line.</p>
		<p>You can also define easy-to-read, multiline strings with a pipe operator, as can be seen in the <code class="entity">description</code> entity.</p>
    <p>In almost all cases, leading and trailing spaces are not meaningful and
    will be ignored allowing you to align the string id and values in a
    resource file for better readability.</p>
    <p>In a rare cases where leading and/or trailing spaces are meaningful,
    L20n allows for special quote delimited strings as can be seen in the <code
    class="entity">moreInfo</code> entity.</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
		>about       = About Our Software
description =
  | Loki is a simple micro-blogging
  | app written entirely in &lt;i>HTML5&lt;/i>.
  | It uses L20n to implement localization.
moreInfo    =   "  Read more about us! "
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
