$(function() {

  const headerScript = document.head.querySelector('script[type="application/l20n"]');
  const l20nSource = headerScript ? headerScript.textContent : '';


  function localizeDocument(ctx, entries) {
    const nodes = document.querySelectorAll('[data-l10n-id]');
    for (let i = 0; i < nodes.length; i++) {
      const l10nId = nodes[i].getAttribute('data-l10n-id');
      const l10nArgs = nodes[i].getAttribute('data-l10n-args');

      const val = L20n.format(ctx, L20n.lang, l10nArgs, entries[l10nId]);

      nodes[i].textContent = val[1];
    }
  }

  function update() {
    const source = l20nSource + '\n' + sourceEditor.getValue();
    const {
      entries,
      _errors
    } = L20n.Parser.parseResource(source);
    const ctx = new L20n.Context(entries);
    localizeDocument(ctx, entries);
	}




  /* Ace */
  sourceEditor = ace.edit('editor');
  sourceEditor.setTheme("ace/theme/monokai");
  sourceEditor.setShowPrintMargin(false);
  sourceEditor.setDisplayIndentGuides(false);
  sourceEditor.getSession().setUseWrapMode(true);
  sourceEditor.getSession().setMode("ace/mode/yaml");
  sourceEditor.clearSelection();
  sourceEditor.getSession().on('change', update);

  update();


	/* data-l10n-id attributes */

	$('[data-l10n-id]').hover(function() {
		if ($('#inspect').prop('checked')) {
			$(this).css('box-shadow', '0 0 5px #75715E');
			var tooltip = $('#tooltip'),
				id = $(this).data('l10n-id'),
				top = $(this).offset().top + $(window).scrollTop() - tooltip.outerHeight(),
				left = $(this).offset().left + $(window).scrollLeft();

			// Display tooltip at the bottom if otherwise too high
			if (top < 0) {
				top += $(this).outerHeight() + tooltip.outerHeight();
			};
			tooltip.html("&lt;" + id + "&gt;").offset({top: top, left: left}).show();
		}
	}, function() {
		$(this).css('box-shadow', 'none');
		$('#tooltip').offset({top: 0, left: 0}).hide();
	});

});
