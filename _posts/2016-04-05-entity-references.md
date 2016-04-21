---
category: learn
layout: learn
title: "Entity References"
---

<section class="clearfix">
	<div class="left">
		<p>In some scenarios it may be useful to reference one entity from another.</p>
    <p>Cases like referencing brand name or menu options allow for easier
    localization maintainence and consistency.</p>
    <p>In L20n user can reference another entity by simply passing an entity ID
    into the placeable.</p>
	</div>
  <div class="right">
		<div class="editor sourceEditor height10"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
		>brandName = Loki
installing = Installing { brandName }.

menu-save = Save
help-menu-save = Click "{ menu-save }" to save the file.
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
