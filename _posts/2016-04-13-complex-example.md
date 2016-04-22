---
category: learn
layout: learn
title: "Comments"
---

<section class="clearfix">
	<div class="left">
    <p>Here's a complex example.</p>
	</div>
  <div class="right">
    <div class="editor dataEditor height5"
      id="dataEditor1"
      data-source="sourceEditor1"
      data-output="output1"
      data-ctxdata="dataEditor1"
    >{
  "user": "mkablnik"
}
    </div>
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
      data-ctxdata="dataEditor1"
		>liked-photo = { LEN($people) ->
    [1]     { $people } lubi
    [2]     { $people } lubią
    [3]     { TAKE(2, $people), "jedna inna osoba" } lubią

   *[other] { TAKE(2, $people),
              "{ LEN(DROP(2, $people)) ->
                  [1]    jedna inna osoba lubią
                  [few]  { LEN(DROP(2, $people)) } inne osoby lubią
                 *[many] { LEN(DROP(2, $people)) } innych osób lubi
               }"
            }
} Twoje zdjęcie.
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
