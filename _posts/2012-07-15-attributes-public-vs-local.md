---
category: learn
layout: learn
title: "Attributes: public vs. local"
prev_section: entities-public-vs-local
prev_title: "Entities: public vs. local"
next_title: Complex plurals
---

<section class="clearfix">
  <div class="left">
    <p>As mentioned in the <a href="{% post_url 2012-07-14-entities-public-vs-local %}">previous chapter</a>, localizers are free to modify their localization without affecting any other language or the source code.</p>
    <p>Not only entities, but also local attributes can be defined. We use this feature in the example to show the right colophon based on the product version.</p>
  </div>
  <div class="right">
    <div class="editor sourceEditor height15"
      id="sourceEditor1"
      data-source="sourceEditor1"
      data-output="output1"
    >&lt;name "Twitter"
 _version: "testing"
&gt;
&lt;colophon[name::_version] {
  production: "{% raw %}{{ name }}{% endraw %} is stable. There are no bugs!",
  testing: "{% raw %}{{ name }}{% endraw %} is still in development. Expect bugs."
}&gt;
    </div>
    <dl id="output1">
    </dl>
  </div>
</section>
