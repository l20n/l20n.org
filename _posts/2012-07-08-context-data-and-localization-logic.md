---
category: learn
layout: learn
title: Context data and localization logic
prev_section: context-data
next_section: macros
---

Context data can be very useful in defining simple logic for L20n to obey.  You can write your L20n code such that it adapts to different values of context data variables.  For instance, you can instruct L20n to choose a variant of the translation based on the user's gender.

The user's gender is unknown at the time of writing the L20n code.  The developer is responsible for assigning a value to it at runtime.  As a localizer, you can prepare your L20n code in a way that accommodates all (or most) of the possible values of the user's gender variable.

Dictionary indexes (see <a href="{% post_url 2012-07-05-indexes-for-hash-tables %}">Chapter 5</a>) are the perfect tool for achieving this.  You can define multiple variants of the translation, one for each gender, and then use an index defined on the entity to select the proper message.

<div class="editor dataEditor height5"
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
<div class="editor sourceEditor height5"
  id="sourceEditor1"
  data-source="sourceEditor1"
  data-ctxdata="dataEditor1"
  data-output="output1"
>&lt;shared[$user.gender] {
  masculine: "{% raw %}{{ $user.name }}{% endraw %} shared your post to his {% raw %}{{ $user.followers }}{% endraw %} follower(s).",
  feminine: "{% raw %}{{ $user.name }}{% endraw %}  shared your post to her {% raw %}{{ $user.followers }}{% endraw %} follower(s).",
 *unknown: "{% raw %}{{ $user.name }}{% endraw %} shared your post to {% raw %}{{ $user.followers }}{% endraw %} follower(s)."
}&gt;
</div>
<dl id="output1">
</dl>
