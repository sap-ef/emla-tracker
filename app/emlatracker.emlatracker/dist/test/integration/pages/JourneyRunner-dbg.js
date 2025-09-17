sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"emlatracker/emlatracker/test/integration/pages/EMLACustomersList",
	"emlatracker/emlatracker/test/integration/pages/EMLACustomersObjectPage"
], function (JourneyRunner, EMLACustomersList, EMLACustomersObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('emlatracker/emlatracker') + '/test/flpSandbox.html#emlatrackeremlatracker-tile',
        pages: {
			onTheEMLACustomersList: EMLACustomersList,
			onTheEMLACustomersObjectPage: EMLACustomersObjectPage
        },
        async: true
    });

    return runner;
});

