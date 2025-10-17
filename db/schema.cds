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
      erpOnbAdvNome  : String(100);
      btpOnbAdvNome  : String(100);
      btpOnbAdvEmail : String(100);
      status         : String(100);
      trackApp       : String(36);
      completedOn    : Date;
}

entity EMLATypeVH as
  select from EMLACustomers {
    key emlaType
  }
  group by
    emlaType;

entity BTPOnbAdvEmailVH as
  select from EMLACustomers {
    key btpOnbAdvEmail
  }
  group by
    btpOnbAdvEmail;

entity OnboardAdvisors {
    key onbAdvisor : String;
        name       : String;
        email      : String;

}
