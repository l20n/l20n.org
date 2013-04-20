$(function() {

	/* L20n */

	var parser = new L20n.Parser(L20n.EventEmitter);
	var compiler = new L20n.Compiler(L20n.EventEmitter, L20n.Parser);

	compiler.setGlobals({
		get hour() {
			return new Date().getHours();
		},
		get os() {
			if (/^MacIntel/.test(navigator.platform)) {
				return 'mac';
			}
			if (/^Linux/.test(navigator.platform)) {
				return 'linux';
			}
			if (/^Win/.test(navigatgor.platform)) {
				return 'win';
			}
			return 'unknown';
		},
		screen: {
			get width() {
				return document.body.clientWidth;
			},
			get height() {
				return document.body.clientHeight;
			},
		}
	});

	function update() {
		$("#output").empty();
		var code = source.getValue();
		var ast = parser.parse(code);
		try {
			data = JSON.parse(context.getValue());
		} catch (e) {}
		var entries = compiler.compile(ast);

		for (var id in entries) {
			if (entries[id].expression) {
				continue;
				$("#output").append("<div><dt><code class=\"disabled\">" + id + "()</code></dt><dd></dd></div>");
			}
			var val;
			try {
				val = entries[id].toString(data);
			} catch (e) {
				if (e instanceof compiler.ValueError) {
					val = e.source;
				} else {
					$("#output").append("<div><dt><code class=\"disabled\">" + e.entry + "</code></dt><dd></dd></div>");
					continue;
				}
			}
			$("#output").append("<div><dt><code>" + id + "</code></dt><dd>" + val + "</dd></div>");
			$('[data-l10n-id="' +  id + '"]').html(val);
		}
	}



	/* Ace */

	try {
		var source = ace.edit("editor");
		source.setShowPrintMargin(false);
		source.setDisplayIndentGuides(false);
		source.getSession().setUseWrapMode(true);
		source.setTheme("ace/theme/monokai");
		source.getSession().setMode("ace/mode/php");
		source.clearSelection();
		source.getSession().on('change', update);
		update();
	} catch (e) {}



	/* Icons */

	try {
		var learn = Raphael("learn", 130, 130),
		    learnPath = "M16.604,1.914c0-0.575-0.466-1.041-1.041-1.041s-1.041,0.466-1.041,1.041v1.04h2.082V1.914zM16.604,22.717h-2.082v3.207c0,0.574-4.225,4.031-4.225,4.031l2.468-0.003l2.807-2.673l3.013,2.693l2.272-0.039l-4.254-4.011V22.717L16.604,22.717zM28.566,7.113c0.86,0,1.56-0.698,1.56-1.56c0-0.861-0.698-1.56-1.56-1.56H2.561c-0.861,0-1.56,0.699-1.56,1.56c0,0.862,0.699,1.56,1.56,1.56h1.583v12.505l-0.932-0.022c-0.861,0-1.213,0.467-1.213,1.04c0,0.576,0.352,1.041,1.213,1.041h24.597c0.86,0,1.299-0.465,1.299-1.041c0-1.094-1.299-1.04-1.299-1.04l-0.804,0.109V7.113H28.566zM11.435,17.516c-3.771,0-4.194-4.191-4.194-4.191c0-4.096,4.162-4.161,4.162-4.161v4.161h4.193C15.596,17.516,11.435,17.516,11.435,17.516zM18.716,13.388h-1.071v-1.073h1.071V13.388zM18.716,10.267h-1.071V9.194h1.071V10.267zM23.314,13.388H20.26c-0.296,0-0.535-0.24-0.535-0.536c0-0.297,0.239-0.537,0.535-0.537h3.057c0.297,0,0.535,0.24,0.535,0.537C23.852,13.147,23.611,13.388,23.314,13.388zM23.314,10.267H20.26c-0.296,0-0.535-0.239-0.535-0.535c0-0.297,0.239-0.537,0.535-0.537h3.057c0.297,0,0.535,0.24,0.535,0.537C23.852,10.027,23.611,10.267,23.314,10.267z",
		    implement = Raphael("implement", 130, 130),
		    implementPath = "M24.946,9.721l-2.872-0.768l-0.771-2.874l3.188-3.231c-1.992-0.653-4.268-0.192-5.848,1.391c-1.668,1.668-2.095,4.111-1.279,6.172l-3.476,3.478l-3.478,3.478c-2.062-0.816-4.504-0.391-6.173,1.277c-1.583,1.581-2.043,3.856-1.39,5.849l3.231-3.188l2.874,0.77l0.769,2.872l-3.239,3.197c1.998,0.665,4.288,0.207,5.876-1.384c1.678-1.678,2.1-4.133,1.271-6.202l3.463-3.464l3.464-3.463c2.069,0.828,4.523,0.406,6.202-1.272c1.592-1.589,2.049-3.878,1.384-5.876L24.946,9.721z";

		learn.path(learnPath).attr({fill: "#F92672", stroke: "none", transform: "t50,50s4"});
		implement.path(implementPath).attr({fill: "#F92672", stroke: "none", transform: "t50,50s4.5"});
	} catch (e) {}



	/* Menu */

	$('.toggle').click(function() {
		var active = false;
		if (!$(this).is('.active')) {
			$(this).addClass('active');
		} else {
			active = true;
		}
		$(this).parent().next().toggle(0, function() {
			if (active) {
				$('.toggle').removeClass('active');
			}
		});
	});



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
