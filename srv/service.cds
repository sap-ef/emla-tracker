using {EMLATracker as db} from '../db/schema.cds';

@path: '/service/EMLATrackerService'
service EMLATrackerService {

    @Capabilities.DeleteRestrictions.Deletable: false
    @cds.redirection.target
    entity EMLACustomers    as projection on db.EMLACustomers {
        *,
        virtual nextActionDate                        : Date,
        followUp.ID                                   as followUpID                    : UUID,
        followUp.isSessionInterested                  as followUpIsSessionInterested   : Boolean
    }
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
                    'isTrackAppRejected',
                    'isTrackAppTP2Rejected',
                    'isTrackAppSHRejected',
                    'trackAppStatus',
                    'trackAppTP2Status',
                    'trackAppSHStatus',
                    'trackAppDate',
                    'trackAppTP2Date',
                    'trackAppSHDate',
                    'notes'
                ],
                TargetEntities  : ['EMLACustomers']
            }
            action sessionSync() returns String;
            
            
        };

    entity OnboardAdvisors  as projection on db.OnboardAdvisors;
    entity AnalyzeEngagementProgress as projection on db.AnalyzeEngagementProgress;

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

    // Analyze engagement progress - not bound to EMLACustomers
    action importAnalyzeEngagementProgress(internalInDays: Integer) returns String;

    // Follow-up entities
    entity FollowUp          as projection on db.FollowUp;
    entity FollowUpScenarios as projection on db.FollowUpScenarios;

    entity FollowUpTracking  as projection on db.FollowUpTracking
        actions {
            @Common.SideEffects: {
                TargetProperties: ['trackApp'],
                TargetEntities  : ['FollowUpTracking']
            }
            @Core.OperationAvailable: true
            action createVCRSession() returns String;
        };

    @readonly
    entity Scenarios         as projection on db.Scenarios;

    action onbFollowUpTrackApp(ID: UUID) returns String;
}

annotate EMLATrackerService with @requires: ['authenticated-user'];
