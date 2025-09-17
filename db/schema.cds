namespace EMLATracker;

@assert.unique.uniqueCustomerProduct: [
    customerNumber,
    emlaType
]
entity EMLACustomers {
    key ID             : UUID;
        externalID     : String(40);
        customerName   : String(250);
        customerNumber : String(20);
        emlaType       : String(50);
        region         : String(25);
        country        : String(25);
        startDate      : Date;
        btpOnbAdvNome  : String(100);
        btpOnbAdvEmail : String(100);
        status         : String(100);
        trackApp       : String(36);
        completedOn    : Date;
}
