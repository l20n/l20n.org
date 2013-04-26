---
category: learn
layout: learn
title: Context data
prev_section: attributes
next_section: context-data-and-localization-logic
---

Context data is how entities defined in L20n resources can interact with non-localizable variables provided by the software developer.  Context data is generally unknown at the time of writing the L20n code. By assigning values to it, the developer makes it known at runtime.

There are all kinds of external data that might be useful in providing a good localization: user names, number of unread messages, battery level, current time, time left before an alarm goes off etc.

Developers define these as context data, which is then available to all entities in the context.

To reference a context data variable, use the dollar syntax in your L20n code: `$user`.  `user` has to be defined in the context data.  In the examples below, we insert the value of a context data variable into an entity's value.

<div id="editor1" class="editor height5">{
    "user": "Jane"
}
</div>
<div id="editor2" class="editor height5">&lt;liked "{% raw %}{{ $user }}{% endraw %} liked your post."&gt;
</div>
<dl id="output">
</dl>

Context data is a JSON object.  The developer chooses the exact structure:  it can be flat or nested, and you can access the nodes of the JSON object the same way you access members of L20n dictionaries, i.e. with the dot syntax.

<div id="editor3" class="editor height15">{
    "user": {
        name: "Jane",
        followers: "1337"
    }
}
</div>
<div id="editor4" class="editor height5">&lt;shared "{% raw %}{{ $user.name }}{% endraw %} shared your post to {% raw %}{{ $user.followers }}{% endraw %} follower(s)."&gt;
</div>
<dl id="output">
</dl>