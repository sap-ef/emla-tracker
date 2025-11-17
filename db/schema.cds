namespace EMLATracker;

using {managed} from '@sap/cds/common';

@assert.unique.uniqueCustomerProduct: [
  customerNumber,
  emlaType
]
entity EMLACustomers : managed {
  key ID                     : UUID;
      externalID             : String(40);
      customerName           : String(250);
      customerNumber         : String(20);
      emlaType               : String(50);
      region                 : String(25);
      country                : String(25);
      startDate              : Date;
      erpOnbAdvNome          : String(100);
      btpOnbAdvNome          : String(100);
      btpOnbAdvEmail         : String(100);
      status                 : String(100);
      trackApp               : String(36);
      trackAppTP2            : String(36);
      trackAppSH             : String(36);

      trackAppStatus         : String(20);
      trackAppTP2Status      : String(20);
      trackAppSHStatus       : String(20);

      isTrackAppCompleted    : Boolean default false;
      isTrackAppTP2Completed : Boolean default false;
      isTrackAppSHCompleted  : Boolean default false;

      isTrackAppRejected     : Boolean default false;
      isTrackAppTP2Rejected  : Boolean default false;
      isTrackAppSHRejected   : Boolean default false;

      completedOn            : Date;
}

entity EMLATypeVH       as
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

entity AnalyzeEngagementProgress {
  key ID                          : UUID;
      btpOnboardingAdvisor_userId : String;
      status                      : String;
      detailedStatusName          : String;
      engagementTaskName          : String;
      customerId                  : String;
      date                        : Date;
}
