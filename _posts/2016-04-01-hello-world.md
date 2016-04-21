---
category: learn
layout: learn
---

<section class="clearfix">
	<div class="left">
		<p>This is an entity called <code class="entity">hello</code>. Entities are containers for information. You use entities to identify, store, and recall information to be used in the software's UI.</p>
		<p>In its simplest form, an entity stores a value; here it's a string, <code>Hello, World!</code>.  Most of the entities you will work with in L20n will look similar to  this.  Some will be more complex, have more than one value variant, or use expressions to select the right variant depending on the circumstances.</p>
		<p>How does the information stored in an entity end up on the user's screen and in the UI?  L20n operates in self-contained instances called "contexts".  Each context stores information about languages available to it, downloaded resource files and all entities in these resource files.  Software developers can create contexts and query them for values of specific entities.</p>
	</div>
	<div class="right">
		<div class="editor sourceEditor height5"
		  id="sourceEditor1"
		  data-source="sourceEditor1"
		  data-output="output1"
		>hello = Hello, World!
		</div>
		<dl id="output1">
		</dl>
	</div>
</section>
