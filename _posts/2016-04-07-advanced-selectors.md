---
category: learn
layout: learn
title: "Advanced Selectors"
---

<section class="clearfix">
	<div class="left">
    <p>Selectors are pretty powerful. A localizer can use any builtin
    explicitly and select a string variant depending on its output. In case of
    <code class="entity">key1</code> entity, we used <code>LEN</code> builtin
    and select the variant of the string depending on its output.</p>
    <p>Additionally, the code specifies a default variant to be used if none of
    the others match. It's denoted with a <code>*</code> operator in front of
    the variant name.</p>
    <p>This can be used in the <code>PLURAL</code> selector example to specify
    a special case for when there are no unread emails.</p>
	</div>
  <div class="right">
    <div class="editor dataEditor height5"
      id="dataEditor1"
      data-source="sourceEditor1"
      data-ctxdata="dataEditor1"
      data-output="output1"
    >{
  "users": ["John", "Mary"],
  "unreadEmails": 0
}
    </div>
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
      data-ctxdata="dataEditor1"
		  data-output="output1"
		>available-users = { LEN($users) ->
  [0] No users
  [1] One user.
  [2] Two users.
 *[other] { LEN($users) } users.
}

unread-emails = You have { $unreadEmails ->
  [0] no unread emails.
  [one] one unread email.
 *[other] { $unreadEmails } unread emails.
}
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
