namespace EMLATracker;

using {managed} from '@sap/cds/common';

@assert.unique.uniqueCustomerProduct: [
  customerNumber,
  emlaType
]
entity EMLACustomers : managed {
  key ID                             : UUID;
      externalID                     : String(40);
      customerName                   : String(250);
      customerNumber                 : String(20);
      emlaType                       : String(50);
      region                         : String(25);
      country                        : String(25);
      startDate                      : Date;
      erpOnbAdvNome                  : String(100);
      btpOnbAdvNome                  : String(100);
      btpOnbAdvEmail                 : String(100);
      status                         : String(100);
      trackApp                       : String(36);
      trackAppTP2                    : String(36);
      trackAppSH                     : String(36);

      btpOnbAdvAssignedOn            : Date;

      productList                    : String(150);
      productName                    : String(50);
      productSKU                     : String(12);

      isBTPOnboardingSessionRequired : Boolean default false;

      actualEffort                   : Decimal(10, 2) default 0;
      contractBaselineEffort         : Decimal(10, 2) default 0;

      trackAppStatus                 : String(30);
      trackAppTP2Status              : String(30);
      trackAppSHStatus               : String(30);

      trackAppDate                   : Date;
      trackAppTP2Date                : Date;
      trackAppSHDate                 : Date;

      isTrackAppCompleted            : Boolean default false;
      isTrackAppTP2Completed         : Boolean default false;
      isTrackAppSHCompleted          : Boolean default false;

      isTrackAppRejected             : Boolean default false;
      isTrackAppTP2Rejected          : Boolean default false;
      isTrackAppSHRejected           : Boolean default false;

      completedOn                    : Date;
      notes                          : String(5000);
      followUp                       : Composition of one FollowUp
                                           on followUp.customer = $self;
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

// Global catalog of scenarios, organized by EMLA type
@assert.unique.uniqueScenario: [emlaType, name]
entity Scenarios : managed {
  key ID       : UUID;
      emlaType : String(50);
      name     : String(200);
}

// Follow-up record — 1:1 with EMLACustomers, owned via Composition
@assert.unique.uniqueFollowUpPerCustomer: [customer]
entity FollowUp : managed {
  key ID                  : UUID;
      customer            : Association to one EMLACustomers;
      returnDate          : Date;
      btpOnbAdvEmail      : String(100);
      isSessionInterested : Boolean default false;
      trackApp            : String(36);
      isVRCCompleted      : Boolean default false;
      isVRCRejected       : Boolean default false;
      vrcStatus           : String(30);
      vrcDate             : Date;
      notes               : String(5000);
      scenarios           : Composition of many FollowUpScenarios
                                on scenarios.followUp = $self;
}

// Junction: selected scenarios per FollowUp
entity FollowUpScenarios {
  key ID       : UUID;
      followUp : Association to one FollowUp;
      scenario : Association to one Scenarios;
}

// Flat view: EMLACustomers + FollowUp data for the Follow-up tracking tab
entity FollowUpTracking as select from FollowUp as f
    inner join EMLACustomers as c on f.customer.ID = c.ID {
    key c.ID,
        f.ID              as followUpID,
        c.customerName,
        c.customerNumber,
        c.emlaType,
        c.region,
        f.returnDate,
        f.btpOnbAdvEmail  as btpOnbAdvEmail,
        f.isSessionInterested,
        f.trackApp,
        f.isVRCCompleted,
        f.isVRCRejected,
        f.vrcStatus,
        case when f.vrcStatus is not null and f.vrcStatus != '' then f.vrcStatus else 'Not Completed' end as vrcDisplayStatus : String(30),
        f.vrcDate,
        f.notes           as followUpNotes
};
