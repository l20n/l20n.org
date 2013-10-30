---
category: learn
layout: learn
title: "12. Building macros and expressions"
prev_section: macros
prev_title: "11. Plural forms (introduction to macros)"
next_section: globals-hour
next_title: "13. Adapting translations to current time"
---

<section class="clearfix">
  <div class="left">
    <p>L20n uses a simple arithmetic and logical expression syntax inspired by C.  Expressions can be used inside of strings, in indexes, as arguments passed to macros and, most commonly, as macro bodies.</p>
    <p>Expressions look like anonymous macros, but there is one important difference:  macros force the return values to be primitives (string, number or boolean).</p>
    <p>In the first example we take the <code>$sizeInKB</code> variable from context data and convert it to megabytes by using an arithmetic expression.</p>
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
		<p>In the second example we calculate the <a href="http://en.wikipedia.org/wiki/Factorial">factorial</a> of a variable <code>$number</code> given in the context data. The mathematical definition of the factorial function is implemented by using conditional and binary operators.  The purpose of the example is to demonstrate the syntax and capacities of expressions rather than an actual use-case;  hopefully, you won't need to implement a factorial to build localized UI.</p> 
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
