---
category: learn
layout: learn
title: "Adapting translations to user's operating system"
---

<section class="clearfix">
  <div class="left">
    <p>If the user's operating system has a distinct and established glossary, you may need multiple variants of the translation to ensure consistency.  The <code>@os</code> global can be used to achieve this.  As of L20n 1.0, it has three possible values: "win", "mac" and "linux".</p>
    <p>In a similar fashion, it may be desirable to define multiple accesskeys depending on the translation variant being used.  In the first example, <code>accesskey</code> is an <a href="{% post_url 2012-07-09-attributes %}">attribute</a> defined on the <code class="entity">settings</code> entity.</p>
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
    <p>To simplify the common cases, a specific key can be defined as the default with an asterisk (<code>*</code>). In the second example, <code>mac</code> and <code>linux</code> are jointly represented as <code>nix</code> in the <code class="entity">settings</code> entity, and <code>win</code> and <code>linux</code> as <code>pc</code> in <code class="entity">help</code>.</p>
    <p>See <a href="{% post_url 2012-07-16-entities-public-vs-local %}">Chapter 16. "Don't repeat yourself: helper entities"</a> for yet a different way of achieving the same result.</p>
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
