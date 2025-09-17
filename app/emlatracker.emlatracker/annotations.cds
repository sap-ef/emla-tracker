using EMLATrackerService as service from '../../srv/service';
annotate service.EMLACustomers with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'externalID',
                Value : externalID,
            },
            {
                $Type : 'UI.DataField',
                Label : 'customerName',
                Value : customerName,
            },
            {
                $Type : 'UI.DataField',
                Label : 'customerNumber',
                Value : customerNumber,
            },
            {
                $Type : 'UI.DataField',
                Label : 'emlaType',
                Value : emlaType,
            },
            {
                $Type : 'UI.DataField',
                Label : 'region',
                Value : region,
            },
            {
                $Type : 'UI.DataField',
                Label : 'country',
                Value : country,
            },
            {
                $Type : 'UI.DataField',
                Label : 'startDate',
                Value : startDate,
            },
            {
                $Type : 'UI.DataField',
                Label : 'btpOnbAdvNome',
                Value : btpOnbAdvNome,
            },
            {
                $Type : 'UI.DataField',
                Label : 'btpOnbAdvEmail',
                Value : btpOnbAdvEmail,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Status',
                Value : Status,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'Customer Name',
            Value : customerName,
        },
        {
            $Type : 'UI.DataField',
            Label : 'Customer Number',
            Value : customerNumber,
        },
        {
            $Type : 'UI.DataField',
            Label : 'EMLA Type',
            Value : emlaType,
        },
        {
            $Type : 'UI.DataField',
            Value : btpOnbAdvEmail,
            Label : 'BTP OA',
        },
        {
            $Type : 'UI.DataField',
            Value : startDate,
            Label : 'Start Date',
        },
        {
            $Type : 'UI.DataField',
            Value : completedOn,
            Label : 'Completed On',
        },
        {
            $Type : 'UI.DataField',
            Value : status,
            Label : 'Status',
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action : 'EMLATrackerService.setCompleted',
            Label : 'Set as Completed',
        },
        {
            $Type : 'UI.DataField',
            Value : trackApp,
            Label : 'trackApp',
            @UI.Hidden,
        },
        {
            $Type : 'UI.DataField',
            Value : externalID,
            Label : 'externalID',
            @UI.Hidden,
        },
    ],
);

