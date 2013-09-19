---
category: learn
layout: learn
title: "Globals: @hour"
prev_section: expressions
prev_title: Expressions
next_section: globals-os
next_title: "Globals: @os"
---

<section class="clearfix">
  <div class="left">
    <p>Globals (or global variables) are similar to context data, but they don't need to be provided by developers. They are made available by L20n.</p>
    <p>Just like context data, globals are usually unknown at the time of writing the L20n code; values are assigned by L20n at runtime.</p>
    <p>To reference a global variable, use the @-syntax in your L20n code. In the first example, we insert the value of a global <code>@hour</code> into an entity's value.</p>
  </div>
  <div class="right">
    <div class="editor sourceEditor height5"
      id="sourceEditor1"
      data-source="sourceEditor1"
      data-output="output1"
    >&lt;now "It's {% raw %}{{ @hour }}{% endraw %} o'clock."&gt;
    </div>
    <dl id="output1">
    </dl>
  </div>
</section>

<section class="clearfix">
  <div class="left">
    <p>Available are three global variables: <code>@hour</code>, <a href="{% post_url 2012-07-12-globals-os %}"><code>@os</code></a> and <a href="{% post_url 2012-07-13-globals-screen %}"><code>@screen</code></a>. In the next example, we'll demonstrate how to use the first one to change greeting based on time of day.</p>
    <p>We start with an entity <code class="entity">greeting</code>, which is a dictionary of four different greetings with macro <code>timeOfDay()</code> used as an index.</p>
    <p>The macro takes <code>@hour</code> as an argument, which is set to the hour of the current system time at runtime. And based on that hour, macro then returns appropriate part of the day and the right greeting gets displayed.</p>
  </div>
  <div class="right">
    <div class="editor sourceEditor height15"
	  id="sourceEditor2"
	  data-source="sourceEditor2"
	  data-output="output2"
    >&lt;timeOfDay($h) { $h &lt; 6 ? "night" :
                   $h &lt; 12 ? "morning" :
                     $h &lt; 18 ? "afternoon" :
                       "evening" }&gt;
&lt;greeting[timeOfDay(@hour)] {
  morning: "Good morning!",
  afternoon: "Good afternoon!",
  evening: "Good evening!",
 *other: "O hai!"
}&gt;
	</div>
    <dl id="output2">
    </dl>
  </div>
</section>
