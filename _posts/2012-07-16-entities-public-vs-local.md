---
category: learn
layout: learn
title: "16. Don't repeat yourself: helper entities"
prev_section: globals-screen
prev_title: "15. Adapting translations to screen size"
next_section: attributes-public-vs-local
next_title: "17. Putting it all together: Complex plurals example"
---

<section class="clearfix">
  <div class="left">
    <p>In L20n, if Polish needs declensions, they can use them, but it doesn't mean developers have to implement them for English too. If French needs genders, they can have them, but it doesn't mean that Basque will have to deal with gender-specific strings in their translations.</p>
    <p>Localization files can be asymmetrical and have more entities than the source language. Localizer is free to do whatever she feels is right and needed in her language without affecting any other language or the source code.</p>
    <p>For example, she can create entities. In previous chapters we only used public entities, that are available in all languages. Local entities however are created by the localizer and thus only available in her language. They are prepended with an underscore (<code>_</code>).</p>
    <p>In the example we use local entity to decrease redundancy from <a href="{% post_url 2012-07-14-globals-os %}">Chapter 14. Adapting translations to user's operating system</a>.</p>
  </div>
  <div class="right">
    <div class="editor sourceEditor height25"
      id="sourceEditor1"
      data-source="sourceEditor1"
      data-output="output1"
    >&lt;settings[@os] {
  win: "Settings",
 *nix: "Preferences"
 }
 accesskey[@os]: {
   win: "S",
  *nix: "P"
 }
&gt;
&lt;_modKey[@os] {
 *pc: "Ctrl",
  mac: "Cmd"
}&gt;
&lt;help "To open {% raw %}{{ settings }}, press {{ _modKey }}+{{ settings::accesskey }}{% endraw %}"&gt;
    </div>
    <dl id="output1">
    </dl>
  </div>
</section>
