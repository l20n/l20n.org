---
category: learn
layout: learn
title: "Globals: @os"
prev_section: globals-hour
prev_title: "Globals: @hour"
next_section: globals-screen
next_title: "Globals: @screen"
---

<section class="clearfix">
  <div class="left">
    <p>Many applications, especially web based, are used in different operating systems, which use different linguistic style. To make localized software sound more naturally, different translations are needed for each OS.</p>
    <p>Globals allow just that &mdash; adapting applications to the environment being used. Variable <code>@os</code> has three possible values: "win", "mac" and "linux".</p>
    <p>Another popular example of different translations for different operating systems are access keys.</p>
  </div>
  <div class="right">
    <div class="editor sourceEditor height35"
      id="sourceEditor1"
      data-source="sourceEditor1"
      data-output="output1"
    >&lt;settings[@os] {
 *win: "Settings",
  mac: "Preferences",
  linux: "Preferences"
 }
 accesskey[@os]: {
  *win: "S",
   mac: "P",
   linux: "P"
 }
&gt;
&lt;help[@os] {
 *win: "To open {% raw %}{{ settings }}{% endraw %}, press Ctrl+{% raw %}{{ settings::accesskey }}{% endraw %}",
  mac: "To open {% raw %}{{ settings }}{% endraw %}, press Cmd+{% raw %}{{ settings::accesskey }}{% endraw %}",
  linux: "To open {% raw %}{{ settings }}{% endraw %}, press Ctrl+{% raw %}{{ settings::accesskey }}{% endraw %}"
}&gt;
    </div>
    <dl id="output1">
    </dl>
  </div>
</section>

<section class="clearfix">
  <div class="left">
    <p>To simplify the common cases, catch-all (<code>*</code>) can be used. In the following example, mac and linux are jointly represented as <code>nix</code>, and win and linux as <code>pc</code>.</p>
    <p>See <a href="{% post_url 2012-07-14-entities-public-vs-local %}">Chapter 14. "Entities: public vs. local"</a> for yet a different way of achieving the same result.</p>
  </div>
  <div class="right">
    <div class="editor sourceEditor height25"
      id="sourceEditor2"
      data-source="sourceEditor2"
      data-output="output2"
    >&lt;settings[@os] {
  win: "Settings",
 *nix: "Preferences"
 }
 accesskey[@os]: {
   win: "S",
  *nix: "P"
 }
&gt;
&lt;help[@os] {
 *pc: "To open {% raw %}{{ settings }}{% endraw %}, press Ctrl+{% raw %}{{ settings::accesskey }}{% endraw %}",
  mac: "To open {% raw %}{{ settings }}{% endraw %}, press Cmd+{% raw %}{{ settings::accesskey }}{% endraw %}"
}&gt;
    </div>
    <dl id="output2">
    </dl>
  </div>
</section>
