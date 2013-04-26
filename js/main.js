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
