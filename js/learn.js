$(function() {

  function makeError(e) {
    return `<div class="error">
      <dt><code>${e.name}</code></dt>
      <dd>${e.message}</dd>
    </div>`;
  }

  function update(sourceEditorId, dataEditorId, outputId) {
    const sourceEditor = ace.edit(sourceEditorId);
    const dataEditor = dataEditorId && ace.edit(dataEditorId);
    const output = $("#" + outputId);

    output.empty();
    const {
      entries,
      _errors
    } = L20n.FTLEntriesParser.parseResource(sourceEditor.getValue());

    _errors.forEach(
      e => output.prepend(makeError(e))
    );

    const ctx = new L20n.MockContext(entries);

    let args;
    if (dataEditor) {
      try {
        args = JSON.parse(dataEditor.getValue());
      } catch (e) {
        output.append(makeError(e));
      }
    }

    for (let id in entries) {
      try {
        var [errs, val] = L20n.format(ctx, L20n.lang, args, entries[id]);
        output.append(
          `<div>
            <dt><code>${id}</code></dt>
            <dd>${val}</dd>
          </div>`
        );

        errs.forEach(
          e => output.append(makeError(e))
        );
      } catch (e) {
        output.append(makeError(e));
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
