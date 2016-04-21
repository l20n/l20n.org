---
category: learn
layout: learn
title: "Interpolation and External Arguments"
---

<section class="clearfix">
	<div class="left">
		<p>In L20n strings may use special syntax to incorporate small pieces of
    programmable interface. Those pieces are denoted with curly braces
    <code>{</code> and <code>}</code> and are called placeables.</p>
    <p>The most common use case for a placeable is to put an external argument,
    provided by the developer, into the string.</p>
    <p>There are all kinds of external data that might be useful in providing a
    good localization: user names, number of unread messages, battery level,
    current time, time left before an alarm goes off, etc.</p>
    <p>To reference a context data variable, use the dollar syntax in your L20n code: <code>$user</code>. <code>user</code> has to be defined in the context data.  In the examples below, we insert the value of a context data variable into an entity's value.</p>
	</div>
  <div class="right">
    <div class="editor dataEditor height5"
      id="dataEditor1"
      data-source="sourceEditor1"
      data-ctxdata="dataEditor1"
      data-output="output1"
    >{
  "user": "Jane",
  "emailCount": 5
}
    </div>
		<div class="editor sourceEditor height5"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
      data-ctxdata="dataEditor1"
		  data-output="output1"
		>welcome = Welcome { $user }

unreadEmails = { $user } has { $emailCount } unread emails.
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
