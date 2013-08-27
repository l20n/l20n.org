$(function() {

	/* L20n */

  function update(sourceEditorId, dataEditorId, outputId, ctx) {
    var sourceEditor = ace.edit(sourceEditorId);
    var dataEditor = dataEditorId && ace.edit(dataEditorId);
    var output = $("#" + outputId);

    output.empty();
    ctx.restart();

    ctx.bindResource(sourceEditor.getValue());
    ctx.data = dataEditor && JSON.parse(dataEditor.getValue());
    ctx.build();
    
		for (var id in ctx.entries) {
			if (ctx.entries[id].expression) {
				continue;
				output.append("<div><dt><code class=\"disabled\">" + id + "()</code></dt><dd></dd></div>");
			}
      // we don't use ctx.get() because we want to work with the exception if 
      // it's thrown (ctx.get doesn't throw; instead it falls back nicely on 
      // the sourceString or the id)
			var val;
			try {
				val = ctx.getOrError(id);
			} catch (e) {

        var val = e.source ? e.source : '',
            error = '<div>' + e.name + ': ' + e.message + '</div>';

				output.append('<div class="error"><dt><code>' + id + '</code></dt>' +
          '<dd>' + val + error + '</dd></div>');
				continue;

			}
			output.append("<div><dt><code>" + id + "</code></dt><dd>" + val + "</dd></div>");
		}
	}



  /* Ace */
  $('div.editor').each(function() {
    var sourceEditorId = $(this).data('source');
    var dataEditorId = $(this).data('ctxdata');
    var outputId = $(this).data('output');

    var id = $(this).attr('id');
    var editor = ace.edit(id);

    // use one context for each editor on the page
    var ctx = new Context(outputId);

    editor.setTheme("ace/theme/monokai");
    editor.setShowPrintMargin(false);
    editor.setDisplayIndentGuides(false);
    editor.getSession().setUseWrapMode(true);
    if ($(this).hasClass('sourceEditor')) {
      editor.getSession().setMode("ace/mode/php");
    } else {
      editor.getSession().setMode("ace/mode/json");
    }
    editor.clearSelection();
    editor.getSession().on('change', 
      update.bind(this, sourceEditorId, dataEditorId, outputId, ctx));
    update(sourceEditorId, dataEditorId, outputId, ctx);
  });

});
