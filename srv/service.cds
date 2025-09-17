using {EMLATracker as my} from '../db/schema.cds';

@path: '/service/EMLATrackerService'
service EMLATrackerService {
    entity EMLACustomers as projection on my.EMLACustomers
        actions {
            @Common.SideEffects: {
                TargetProperties: [
                    'status',
                    'completedOn'
                ],
                TargetEntities  : ['EMLACustomers']
            }
            action setCompleted() returns Boolean;
        };

    action onbTrackApp(ID: UUID) returns String;
}

annotate EMLATrackerService with @requires: ['authenticated-user'];
