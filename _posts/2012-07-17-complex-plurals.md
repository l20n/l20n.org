---
category: learn
layout: learn
title: "Putting it all together: Complex plurals example"
---

<section class="clearfix">
  <div class="left">
    <p>In the Firefox download panel, a string like this shows up while downloading file: <code>4 hours, 1 minute and 26 seconds remaining</code>.</p>
    <p>It contains three units, all of which can be in any of the plural forms, available in the target language.</p>
    <p>Languages handle plurals of nouns or unit expressions very differently. Some have only one form; some have two, like English; and some have multiple forms. Slovenian, for example, has <a href="http://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html#sl">four</a>.</p>
    <p>It sounds complex enough to use it as an example.</p>
    <p>First, we need to define the plural macro that will return one of the four plural forms, based on the input argument (number).</p>
    <p>Next, for each of the units (hours, minutes, and seconds), we provide a dictionary with plural forms as keys and translations of units in appropriate plural forms as values.</p>
    <p>And finally, we join the numbers and units in the complete string.</p>
  </div>
  <div class="right">
    <div class="editor dataEditor height10"
          id="dataEditor1"
          data-source="sourceEditor1"
          data-ctxdata="dataEditor1"
          data-output="output1"
        >{
  "hours": 1,
  "minutes": 5,
  "seconds": 17
}
    </div>
    <div class="editor sourceEditor height52"
      id="sourceEditor1"
      data-source="sourceEditor1"
      data-ctxdata="dataEditor1"
      data-output="output1"
    >&lt;plural($n) {
  $n == 0 ? "zero" : 
  $n % 100 == 1 ? "one" : 
  $n % 100 == 2 ? "two" : 
  $n % 100 == 3 || $n % 100 == 4 ? "few" : 
  "many" 
}&gt;
&lt;_hours {
  one: "ura",
  two: "uri",
  few: "ure",
  *many: "ur"
}&gt;
&lt;_minutes {
  one: "minuta",
  two: "minuti",
  few: "minute",
  *many: "minut"
}&gt;
&lt;_seconds {
  one: "sekunda",
  two: "sekundi",
  few: "sekunde",
  *many: "sekund"
}&gt;
&lt;remaining """
  Preostali čas: {% raw %}{{ $hours }} {{ _hours[plural($hours)] }}{% endraw %},
  {% raw %}{{ $minutes }} {{ _minutes[plural($minutes)] }}{% endraw %}, 
  {% raw %}{{ $seconds }} {{ _seconds[plural($seconds)] }}{% endraw %}.
"""&gt;
    </div>
    <dl id="output1">
    </dl>
  </div>
</section>
