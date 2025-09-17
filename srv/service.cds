using { EMLATracker as my } from '../db/schema.cds';

@path : '/service/EMLATrackerService'
service EMLATrackerService
{
    entity EMLACustomers as
        projection on my.EMLACustomers;
}

annotate EMLATrackerService with @requires :
[
    'authenticated-user'
];
