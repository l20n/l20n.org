---
category: learn
layout: learn
title: "Selectors"
---

<section class="clearfix">
	<div class="left">
		<p>One of the most common cases when a localizer needs to use a placeable
    is when there are multiple variants of the string that depend on some
    external argument.</p>
    <p>L20n provides a select expression that chooses one of the provide
    variants based on the given selector.</p>
    <p>By default, when a number external argument is used as a selector, L20n
    implicitly uses <code>PLURAL</code> formatter that selects the proper
    plural case for a given language. In English it will be either
    <code>one</code> or <code>other</code>.</p>
	</div>
  <div class="right">
    <div class="editor dataEditor height5"
      id="dataEditor1"
      data-source="sourceEditor1"
      data-ctxdata="dataEditor1"
      data-output="output1"
    >{
  "unreadEmails": 5
}
    </div>
		<div class="editor sourceEditor height10"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
      data-ctxdata="dataEditor1"
		  data-output="output1"
		>emails = { $unreadEmails ->
  [one] You have one unread email.
  [other] You have { $unreadEmails } unread emails.
}
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
