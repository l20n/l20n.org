---
category: learn
layout: learn
---

<section class="clearfix">
	<div class="left">
		<p>Context data can be very useful in defining simple logic for L20n to obey.  You can write your L20n code such that it adapts to different values of context data variables.  For instance, you can instruct L20n to choose a variant of the translation based on the user's gender.</p>
		<p>The user's gender is unknown at the time of writing the L20n code.  The developer is responsible for assigning a value to it at runtime.  As a localizer, you can prepare your L20n code in a way that accommodates all (or most) of the possible values of the user's gender variable.</p>
		<p>Dictionary indexes (see <a href="{% post_url 2012-07-05-choosing-one-variant %}">Chapter 5. Choosing one variant</a>) are the perfect tool for achieving this.  You can define multiple variants of the translation, one for each supported value, and then use an index defined on the entity to select the proper message.  The example below has two different values for two possible genders in English:</p>
	</div>
	<div class="right">
		<div class="editor dataEditor height15"
		  id="dataEditor1"
		  data-source="sourceEditor1"
		  data-ctxdata="dataEditor1"
		  data-output="output1"
		>{
    "user": {
        "name": "Jane",
        "followers": 1337,
        "gender": "feminine"
    }
}
		</div>
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-ctxdata="dataEditor1"
		  data-output="output1"
		>&lt;shared[$user.gender] {
  masculine: "{% raw %}{{ $user.name }}{% endraw %} shared your post to his {% raw %}{{ $user.followers }}{% endraw %} follower(s).",
  feminine: "{% raw %}{{ $user.name }}{% endraw %}  shared your post to her {% raw %}{{ $user.followers }}{% endraw %} follower(s).",
 *default: "{% raw %}{{ $user.name }}{% endraw %} shared your post to their {% raw %}{{ $user.followers }}{% endraw %} follower(s)."
}&gt;
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
