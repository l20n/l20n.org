$(function() {
	/* L20n */
	var parser = new L20n.Parser(L20n.EventEmitter);
	var compiler = new L20n.Compiler(L20n.EventEmitter, L20n.Parser);

	compiler.setGlobals({
		get hour() {
	 		return new Date().getHours();
		},
	});

	parser.addEventListener('error', function(e) {
		//
	});
	compiler.addEventListener('error', function(e) {
		//
	});

	function update() {
		var code = source.getValue();
		var ast = parser.parse(code);
		var entries = compiler.compile(ast);
		for (var id in entries) {		  
		  /*if (entries[id].expression) {
		    continue;
		    $("#output").append("<div><dt><code class=\"disabled\">" + id + "()</code></dt><dd></dd></div>");
		  } */
		  var val;
		  try {
		    val = entries[id].toString();
		  } catch (e) {
		    if (e instanceof compiler.ValueError) {
		      val = e.source;
		    } else {
		      /*$("#output").append("<div><dt><code class=\"disabled\">" + e.entry + "</code></dt><dd></dd></div>");
		      */continue;
		    }
		  }
		  $('[data-l10n-id="' +  id + '"]').html(val);
		}
	}

	/* ACE */
	var state = (
		"<title \"L20n\">\n" +
		"\n" +
		"<hello[timeOfDay(@hour)] {\n" +
		"  morning: \"Good morning!\",\n" +
		"  afternoon: \"Good afternoon!\",\n" +
		"  evening: \"Good evening!\",\n" +
		" *other: \"Hello!\"\n" +
		"}>\n" +
		"\n" +
		"<welcome \"Welcome to {{ title }}\">\n"
    );

	var source = ace.edit("editor");
	source.setShowPrintMargin(false);
	source.setDisplayIndentGuides(false);
	source.getSession().setUseWrapMode(true);
	source.setTheme("ace/theme/monokai");
	source.getSession().setMode("ace/mode/php");
	source.setValue(state);
	source.clearSelection();
	source.getSession().on('change', update);

	$('.toggle').click(function() {
		var active = false;
		if (!$(this).is('.active')) {
			$(this).addClass('active');
		} else {
			active = true;
		}
		$(this).parent().next().slideToggle(function() {
			if (active) {
				$('.toggle').removeClass('active');
			}
		});
	});
});
