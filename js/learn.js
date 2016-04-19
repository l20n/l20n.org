$(function() {

  function update(sourceEditorId, dataEditorId, outputId) {
    var sourceEditor = ace.edit(sourceEditorId);
    var dataEditor = dataEditorId && ace.edit(dataEditorId);
    var output = $("#" + outputId);

    output.empty();
    let {
      entries,
      _errors
    } = L20n.Parser.parseResource(sourceEditor.getValue());


    _errors.forEach(e => {
      $(`#${outputId}`).prepend(
          `<div class="error"><dt>${e.name}</dt><dd>${e.message}</dd></div>`);
    });
    let ctx = new L20n.Context(entries);

    let data = dataEditor && JSON.parse(dataEditor.getValue());
    
		for (var id in entries) {
			var val;
			try {
				val = L20n.format(ctx, L20n.lang, data, entries[id])[1];
			} catch (e) {
        console.log(e);

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

    editor.setTheme("ace/theme/monokai");
    editor.setShowPrintMargin(false);
    editor.setDisplayIndentGuides(false);
    editor.getSession().setUseWrapMode(true);
    if ($(this).hasClass('sourceEditor')) {
      editor.getSession().setMode("ace/mode/yaml");
    } else {
      editor.getSession().setMode("ace/mode/yaml");
    }
    editor.clearSelection();
    editor.getSession().on('change', 
      update.bind(this, sourceEditorId, dataEditorId, outputId, ctx));
    update(sourceEditorId, dataEditorId, outputId, ctx);
  });

});
