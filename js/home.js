$(function() {

	/* L20n */

  var ctx = new Context();
  var l20nSource = "";
  var headerScript = document.head.querySelector('script[type="application/l20n"]');
  if (headerScript) { 
    l20nSource = headerScript.textContent;
  }
  var docCallback = null;

  function translateDocument(l10n) {
    for (var id in l10n.entities) {
      var entity = l10n.entities[id];
      if (entity.value) {
        var node = document.querySelector('[data-l10n-id=' + id + ']');
        node.textContent = entity.value;
      }
    }
  }

  function localizeDocument() {
    if (!docCallback) {
      var nodes = document.querySelectorAll('[data-l10n-id]');
      var ids = [];
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].hasAttribute('data-l10n-args')) {
          ids.push([nodes[i].getAttribute('data-l10n-id'),
              JSON.parse(nodes[i].getAttribute('data-l10n-args'))]);
        } else {
          ids.push(nodes[i].getAttribute('data-l10n-id'));
        }
      }
      docCallback = ctx.localize(ids, translateDocument);
    } else {
      docCallback.retranslate();
    }
  }

  function update() {
    ctx.restart();
    ctx.bindResource(l20nSource);
    ctx.bindResource(sourceEditor.getValue());
    ctx.build();
    localizeDocument();
	}



  /* Ace */
  sourceEditor = ace.edit('editor');
  sourceEditor.setTheme("ace/theme/monokai");
  sourceEditor.setShowPrintMargin(false);
  sourceEditor.setDisplayIndentGuides(false);
  sourceEditor.getSession().setUseWrapMode(true);
  sourceEditor.getSession().setMode("ace/mode/php");
  sourceEditor.clearSelection();
  sourceEditor.getSession().on('change', update);



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
