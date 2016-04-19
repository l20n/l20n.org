---
category: learn
layout: learn
---

<section class="clearfix">
	<div class="left">
		<p>Context data is how entities defined in L20n resources can interact with non-localizable variables provided by the developer.  Context data is generally unknown at the time of writing the L20n code. By assigning values to it, the developer makes it known at runtime.</p>
		<p>There are all kinds of external data that might be useful in providing a good localization: user names, number of unread messages, battery level, current time, time left before an alarm goes off, etc.</p>
		<p>Developers define these as context data, which is then available to all entities in the context.</p>
		<p>To reference a context data variable, use the dollar syntax in your L20n code: <code>$user</code>. <code>user</code> has to be defined in the context data.  In the examples below, we insert the value of a context data variable into an entity's value.</p>
	</div>
	<div class="right">
		<div class="editor dataEditor height5"
		  id="dataEditor1"
		  data-source="sourceEditor1"
		  data-ctxdata="dataEditor1"
		  data-output="output1"
		>{
    "user": "Jane"
}
		</div>
		<div class="editor sourceEditor height5"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-ctxdata="dataEditor1"
		  data-output="output1"
		>liked = { $user } liked your post.
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>

<section class="clearfix">
	<div class="left">
		<p>Context data is a JSON object.  The developer chooses the exact structure:  it can be flat or nested, and you can access the nodes of the JSON object the same way you access members of L20n dictionaries, i.e. with the dot syntax.</p>
	</div>
	<div class="right">
		<div class="editor dataEditor height15"
		  id="dataEditor2"
		  data-source="sourceEditor2"
		  data-ctxdata="dataEditor2"
		  data-output="output2"
		>
{
    "user_name": "Jane",
    "user_followers": 1337
}
		</div>
		<div class="editor sourceEditor height5"
		  id="sourceEditor2"
		  data-source="sourceEditor2"
		  data-ctxdata="dataEditor2"
		  data-output="output2"
		>
shared = { $user_name } shared your post to { $user_followers } follower(s).
		</div>
		<dl id="output2">
		</dl>
	</div>
</section>
