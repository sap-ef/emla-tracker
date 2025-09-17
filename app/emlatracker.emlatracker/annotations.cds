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
                Label : 'startDateL',
                Value : startDateL,
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
    ],
);

