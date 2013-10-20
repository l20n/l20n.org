---
category: learn
layout: learn
title: Declensions
prev_section: attributes-public-vs-local
prev_title: "Attributes: public vs. local"
next_section: genders
next_title: "Genders"
---

<section class="clearfix">
  <div class="left">
    <p>A lot of applications use about dialogs to display the credits and revision information. They are called something like <code>About Aurora</code>.</p>
    <p>In many inflected languages (e.g. German, Finnish, Hungarian, all Slavic languages), the about preposition <a href="http://en.wikipedia.org/wiki/Case_government">governs the grammatical case</a> of the complement. It might be the accusative (German), ablative (Latin) or locative (Slavic languages).</p>
    <p>In Slovenian, the ideal string would inflect the noun, like so: <code>O Aurori</code>. However, since we want the name of the browser to be stored in the <code class="entity">brandShortName</code> entity, we can't modify it.</p>
    <p>The work-around is to inflect an auxiliary noun complement, e.g. browser, to give <code>About the Aurora browser</code>. Needless to say, this ends up being long and often unnaturally-sounding to the native speakers. See <code class="entity">aboutOld</code> for the example in Slovenian.</p>
    <p>This problem can be easily solved by defining multiple variants of the <code class="entity">brandShortName</code> entity, to match different grammatical cases of the noun.</p>
  </div>
  <div class="right">
    <div class="editor sourceEditor height15"
      id="sourceEditor1"
      data-source="sourceEditor1"
      data-output="output1"
    >&lt;brandShortName {
  *nominative: "Aurora",
  genitive: "Aurore",
  dative: "Aurori",
  accusative: "Auroro",
  locative: "Aurori",
  instrumental: "Auroro"
}&gt;
&lt;aboutOld "O brskalniku {% raw %}{{ brandShortName }}{% endraw %}"&gt;
&lt;about "O {% raw %}{{ brandShortName.locative }}{% endraw %}"&gt;
    </div>
    <dl id="output1">
    </dl>
  </div>
</section>
