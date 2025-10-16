using {EMLATracker as db} from '../db/schema.cds';

@path: '/service/EMLATrackerService'
service EMLATrackerService {
    entity EMLACustomers    as projection on db.EMLACustomers
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

    entity EMLATypeVH       as projection on db.EMLATypeVH;
    entity BTPOnbAdvEmailVH as projection on db.BTPOnbAdvEmailVH;
}

annotate EMLATrackerService with @requires: ['authenticated-user'];
