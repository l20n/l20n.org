---
category: learn
layout: learn
title: Expressions
prev_section: macros
prev_title: Macros
next_section: globals-hour
next_title: "Globals: @hour"
---

<section class="clearfix">
  <div class="left">
    <p>L20n uses a simple arithmetic and logical expression syntax inspired by C. Expressions are like macros, but without names.</p>
    <p>They can be used in strings, in indexes, and in macro calls as both, arguments and bodies. Expressions always return primitives: strings, numbers and booleans.</p>
    <p>In the first example we take the <code>$sizeInKB</code> variable from context data and convert it to megabytes by using a logical expression.</p>
  </div>
  <div class="right">
    <div class="editor dataEditor height5"
      id="dataEditor1"
      data-source="sourceEditor1"
      data-ctxdata="dataEditor1"
      data-output="output1"
    >{
    "sizeInKB": 46080
}
	</div>
    <div class="editor sourceEditor height5"
      id="sourceEditor1"
      data-source="sourceEditor1"
      data-ctxdata="dataEditor1"
      data-output="output1"
    >&lt;tooBig "Attachment too big:
        {% raw %}{{ $sizeInKB / 1024 }}{% endraw %} MB."&gt;
    </div>
    <dl id="output1">
    </dl>
  </div>
</section>

<section class="clearfix">
	<div class="left">
    <p>Several kinds of operators are supported:</p>
    <ul>
      <li>Unary: <code>-</code>, <code>+</code>, <code>!</code></li>
      <li>Binary: <code>&lt;</code>, <code>&lt;=</code>, <code>></code>, <code>>=</code>, <code>==</code>, <code>!=</code>, <code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>, <code>%</code></li>
      <li>Logical: <code>||</code>, <code>&amp;&amp;</code></li>
      <li>Conditional: <code>a ? b : c</code></li>
    </ul>
		<p>In a little bit more complex second example we calculate the <a href="http://en.wikipedia.org/wiki/Factorial">factorial</a> of a variable <code>$number</code> given in context data. The mathematical definition of the factorial function is implemented by using conditional and binary operators.</p>
	</div>
	<div class="right">
    <div class="editor dataEditor height5"
      id="dataEditor2"
      data-source="sourceEditor2"
      data-ctxdata="dataEditor2"
      data-output="output2"
    >{
    "number": 5
}
    </div>
		<div class="editor sourceEditor height15"
		  id="sourceEditor2"
		  data-source="sourceEditor2"
		  data-ctxdata="dataEditor2"
		  data-output="output2"
    >&lt;fac($n) { $n == 0 ?
        1 :
        $n * fac($n - 1) }&gt;

&lt;factorial "Factorial of {% raw %}{{ $number }}
        is {{ fac($number) }}{% endraw %}."&gt;
		</div>
		<dl id="output2">
		</dl>
	</div>
</section>
