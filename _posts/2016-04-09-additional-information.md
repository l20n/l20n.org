---
category: learn
layout: learn
title: "Additional information"
---

<section class="clearfix">
	<div class="left">
    <p>Traits are useful beyond just value variants. They can be also used to
    describe local parameters of the entity that can be then used in other
    selectors.</p>
    <p>Imagine an entity <code class="entity">brandName</code> that can be
    either <code>Firefox</code> or <code>Aurora</code>.The former is <code>masculine</code>, while the latter is
    <code>feminine</code>, so sentences that refer to this entity may want to
    branch depending on the gender of it.</p>
    <p>In L20n we start local traits with an underscore <code>_</code>.</p>
	</div>
  <div class="right">
		<div class="editor sourceEditor height15"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
		>brandName = Firefox
  [_gender] masculine

opened-new-window = { brandName[_gender] ->
 *[masculine] { brandName } otworzyl nowe okno.
  [feminine] { brandName } otworzyla nowe okno.
}
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
