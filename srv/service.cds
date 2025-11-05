using {EMLATracker as db} from '../db/schema.cds';

@path: '/service/EMLATrackerService'
service EMLATrackerService {

    @Capabilities.DeleteRestrictions.Deletable: false
    entity EMLACustomers    as projection on db.EMLACustomers
        actions {
            @Common.SideEffects       : {
                TargetProperties: [
                    'status',
                    'completedOn'
                ],
                TargetEntities  : ['EMLACustomers']
            }
            action setCompleted() returns Boolean;
            
            @Common.SideEffects       : {
                TargetProperties: [
                    'isTrackAppCompleted',
                    'isTrackAppTP2Completed',
                    'isTrackAppSHCompleted',
                    'completedOn'
                ],
                TargetEntities  : ['EMLACustomers']
            }
            action sessionSync() returns String;
        };

    entity OnboardAdvisors  as projection on db.OnboardAdvisors;

    action onbTrackApp(ID: UUID, sessionType: String)    returns String;
    action onbTrackAppTP2(ID: UUID, sessionType: String) returns String;
    action onbTrackAppSH(ID: UUID, sessionType: String)  returns String;

    action uploadCSV(csvData: String, csvType: String)   returns String;

    // Action to sync EMLA data from external system via destination
    // Called by Job Scheduling Service
    action syncEMLAData()                                returns String;

    // Action to update completion status by checking session webservice
    // Finds incomplete sessions and calls webservice to update their status
    action updateSessionStatus()                         returns String;

    entity EMLATypeVH       as projection on db.EMLATypeVH;
    entity BTPOnbAdvEmailVH as projection on db.BTPOnbAdvEmailVH;
}

annotate EMLATrackerService with @requires: ['authenticated-user'];
