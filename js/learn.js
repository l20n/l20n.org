$(function() {

  function update(sourceEditorId, dataEditorId, outputId) {
    const sourceEditor = ace.edit(sourceEditorId);
    const dataEditor = dataEditorId && ace.edit(dataEditorId);
    const output = $("#" + outputId);

    output.empty();
    const {
      entries,
      _errors
    } = L20n.FTLEntriesParser.parseResource(sourceEditor.getValue());


    _errors.forEach(e => {
      $(`#${outputId}`).prepend(
          `<div class="error"><dt>${e.name}</dt><dd>${e.message}</dd></div>`);
    });
    const ctx = new L20n.MockContext(entries);

    const data = dataEditor && JSON.parse(dataEditor.getValue());

		for (let id in entries) {
			try {
				let val = L20n.format(ctx, L20n.lang, data, entries[id])[1];
			  output.append("<div><dt><code>" + id + "</code></dt><dd>" + val + "</dd></div>");
			} catch (e) {
        let val = e.source ? e.source : '',
            error = '<div>' + e.name + ': ' + e.message + '</div>';

				output.append('<div class="error"><dt><code>' + id + '</code></dt>' +
          '<dd>' + val + error + '</dd></div>');
			}
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
    editor.setFontSize(18);
    editor.setDisplayIndentGuides(false);
    editor.getSession().setUseWrapMode(true);
    if ($(this).hasClass('sourceEditor')) {
      editor.getSession().setMode("ace/mode/ft");
    } else {
      editor.getSession().setMode("ace/mode/json");
    }
    editor.clearSelection();
    editor.getSession().on('change', 
      update.bind(this, sourceEditorId, dataEditorId, outputId));
    update(sourceEditorId, dataEditorId, outputId);
  });

});
