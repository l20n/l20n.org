---
category: learn
layout: learn
title: "Entity References"
---

<section class="clearfix">
	<div class="left">
		<p>Sometimes it may be useful to reference one entity from another.  
        This generally helps to keep certain translations consistent across the 
        interface and makes maintenance easier.</p>
        <p>It is also particularly handy for keeping branding separated from the 
        rest of the translations, so that it can be changed easily when needed, 
        e.g. during the build process of the application.</p>
        <p>In l20n you can use the same  <code>{</code> and <code>}</code> 
        syntax to interpolate other entities by their identifier.</p>

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
