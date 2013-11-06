---
category: learn
layout: learn
---

<section class="clearfix">
  <div class="left">
    <p>Globals (or global variables) are similar to context data, but they don't need to be provided by developers. They are made available by L20n and can be used by localizers to adapt translations to the user's current environment.</p>
    <p>Just like context data, globals are usually unknown at the time of writing the L20n code; values are assigned by L20n at runtime.</p>
    <p>To reference a global variable, use the @-syntax in your L20n code. In the first example, we insert the value of the global <code>@hour</code> into an entity's value.</p>
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
    <p>In L20n 1.0 there are three global variables available client-side: <code>@hour</code>, <a href="{% post_url 2012-07-14-adapting-translations-to-users-operating-system %}"><code>@os</code></a> and <a href="{% post_url 2012-07-15-adapting-translations-to-screen-size %}"><code>@screen</code></a>. In the next example, we'll demonstrate how to use the first one to change a greeting based on time of day.</p>
    <p>We start with an entity <code class="entity">greeting</code>, which is a dictionary of four different greetings with the macro <code>timeOfDay()</code> used as in the index.  The macro takes <code>@hour</code> as the only argument.</p>
    <p>Inside of the macro body, the argument is referenced as <code>$h</code>.  At runtime, <code>@hour</code> is set by L20n to the hour of the current system time.  Based on the numerical value of the current hour, the <code>timeOfDay</code> macro returns the appropriate part of the day, which is used to select one of the available variants of the greeting.</p>
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
