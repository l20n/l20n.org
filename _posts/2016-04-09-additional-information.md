---
category: learn
layout: learn
title: "Additional Information"
---

<section class="clearfix">
	<div class="left">
    <p>Traits are useful beyond just value variants. They can be also used to
    describe parameters of the entity that can be then used in other
    selectors.</p>
    <p>Imagine an entity <code class="entity">brandName</code> that can be
    either <code>Firefox</code> or <code>Aurora</code>.The former is <code>masculine</code>, while the latter is
    <code>feminine</code>, so sentences that refer to this entity may want to
    branch depending on the gender of it.</p>
	</div>
  <div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
		>brandName = Firefox
  [gender] masculine

opened-new-window = { brandName[gender] ->
 *[masculine] { brandName } otworzyl nowe okno.
  [feminine] { brandName } otworzyla nowe okno.
}
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
