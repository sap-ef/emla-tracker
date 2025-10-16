sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"emlatracker/csvupload/test/integration/pages/EMLACustomersMain"
], function (JourneyRunner, EMLACustomersMain) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('emlatracker/csvupload') + '/test/flpSandbox.html#emlatrackercsvupload-tile',
        pages: {
			onTheEMLACustomersMain: EMLACustomersMain
        },
        async: true
    });

    return runner;
});

