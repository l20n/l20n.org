---
category: learn
layout: learn
title: "Complex Example"
---

<section class="clearfix">
	<div class="left">
    <p>Here's a final example. It's a pretty complex and one that you will
    interact with very rarely, but it shows the power of a message that can be
    localized really well thanks to the flexibility of the syntax.</p>
    <p>In this example we branch the string depending on the number of people
    passed as an external argument up to three people, and then, if the number
    is higher, we sum up the list and add the variant for one more person, or
    any number of people.</p>
    <p>This example is very sophisticated and could be localized with a simple
    <code>{ LEN($people) } like your photo</code> which would work well enough
    for English and can be handled for most other languages without increasing
    complexity.</p>
    <p>The power of L20n is that you can use the simple variant and then,
    later, you can invest time to improve the message. If the message is very
    visible to the users, it may be worth spending more time to get a better
    quality of the string, if not, you can leave the simple version.</p>
    <p>But with L20n, you have a choice.</p>
	</div>
  <div class="right">
    <div class="editor dataEditor height5"
      id="dataEditor1"
      data-source="sourceEditor1"
      data-output="output1"
      data-ctxdata="dataEditor1"
    >{
  "people": ["Anna", "Jack", "Mary", "Nick"]
}
    </div>
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
      data-ctxdata="dataEditor1"
		>liked-photo = { LEN($people) ->
    [1]     { $people } likes
    [2]     { $people } like
    [3]     { TAKE(2, $people), "one more person" } like

   *[other] { TAKE(2, $people),
              "{ LEN(DROP(2, $people)) ->
                  [1]    one more person like
                 *[other]  { LEN(DROP(2, $people)) } more people like
               }"
            }
} your photo.
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
