using EMLATrackerService as service from '../../srv/service';

annotate service.EMLACustomers with @(
    UI.FieldGroup #GeneratedGroup: {
        $Type: 'UI.FieldGroupType',
        Data : [
            {
                $Type: 'UI.DataField',
                Label: 'externalID',
                Value: externalID,
            },
            {
                $Type: 'UI.DataField',
                Label: 'customerName',
                Value: customerName,
            },
            {
                $Type: 'UI.DataField',
                Label: 'customerNumber',
                Value: customerNumber,
            },
            {
                $Type: 'UI.DataField',
                Label: 'emlaType',
                Value: emlaType,
            },
            {
                $Type: 'UI.DataField',
                Label: 'region',
                Value: region,
            },
            {
                $Type: 'UI.DataField',
                Label: 'country',
                Value: country,
            },
            {
                $Type: 'UI.DataField',
                Label: 'startDate',
                Value: startDate,
            },
            {
                $Type: 'UI.DataField',
                Label: 'btpOnbAdvNome',
                Value: btpOnbAdvNome,
            },
            {
                $Type: 'UI.DataField',
                Label: 'btpOnbAdvEmail',
                Value: btpOnbAdvEmail,
            },
            {
                $Type: 'UI.DataField',
                Label: 'Status',
                Value: Status,

            },
        ],
    },
    UI.Facets                    : [{
        $Type : 'UI.ReferenceFacet',
        ID    : 'GeneratedFacet1',
        Label : 'General Information',
        Target: '@UI.FieldGroup#GeneratedGroup',
    }, ],
    UI.LineItem                  : [
        {
            $Type                : 'UI.DataField',
            Label                : 'Customer Name',
            Value                : customerName,

            ![@HTML5.CssDefaults]: {width: '100%'},
        },
        {
            $Type                : 'UI.DataField',
            Label                : 'Customer Number',
            Value                : customerNumber,
            ![@HTML5.CssDefaults]: {width: '140px'},
        },
        {
            $Type                : 'UI.DataField',
            Value                : startDate,
            Label                : 'Start Date',
            ![@HTML5.CssDefaults]: {width: '110px'},
        },
        {
            $Type                : 'UI.DataField',
            Value                : completedOn,
            Label                : 'Completed On',
            ![@HTML5.CssDefaults]: {width: '110px'},
        },
        {
            $Type                : 'UI.DataField',
            Value                : nextActionDate,
            Label                : 'Next Action',
            ![@HTML5.CssDefaults]: {width: '110px'},
        },
        {
            $Type                : 'UI.DataField',
            Value                : erpOnbAdvNome,
            Label                : 'ERP OA',
            ![@HTML5.CssDefaults]: {width: '250px'},
        },
        {
            $Type                : 'UI.DataField',
            Value                : btpOnbAdvEmail,
            Label                : 'BTP OA',
            ![@HTML5.CssDefaults]: {width: '250px'},
        },
        {
            $Type                : 'UI.DataField',
            Label                : 'EMLA Type',
            Value                : emlaType,
            ![@HTML5.CssDefaults]: {width: '180px'},
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'EMLATrackerService.setCompleted',
            Label : 'Set / Unset as Completed',
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'EMLATrackerService.sessionSync',
            Label : 'Session Sync',
        },
    ],
    UI.SelectionFields           : [
        emlaType,btpOnbAdvEmail,
        status, ],
    UI.SelectionPresentationVariant #table : {
        $Type : 'UI.SelectionPresentationVariantType',
        PresentationVariant : {
            $Type : 'UI.PresentationVariantType',
            Visualizations : [
                '@UI.LineItem',
            ],
            GroupBy : [
                emlaType,
            ],
            SortOrder : [
                {
                    $Type : 'Common.SortOrderType',
                    Property : startDate,
                    Descending : false,
                },
            ],
        },
        SelectionVariant : {
            $Type : 'UI.SelectionVariantType',
            SelectOptions : [
                {
                    $Type : 'UI.SelectOptionType',
                    PropertyName : status,
                    Ranges : [
                        {
                            Sign : #I,
                            Option : #NE,
                            Low : 'Completed',
                        },
                    ],
                },
            ],
        },
    },
);

annotate service.EMLACustomers with {
    btpOnbAdvEmail @(
        Common.Label: 'BTP OA Email',
        Common.ValueList : {
            $Type : 'Common.ValueListType',
            CollectionPath : 'BTPOnbAdvEmailVH',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : btpOnbAdvEmail,
                    ValueListProperty : 'btpOnbAdvEmail',
                },
            ],
            Label : 'BTP Onb Advisors',
        },
        Common.ValueListWithFixedValues : true,
    )
};
annotate service.EMLACustomers with {
    completedOn @Common.Label : 'Completed On'
};

annotate service.EMLACustomers with {
    status @Common.Label : 'Status'
};

annotate service.EMLACustomers with {
    emlaType @(
        Common.Label : 'EMLA Type',
        Common.ValueList : {
            $Type : 'Common.ValueListType',
            CollectionPath : 'EMLATypeVH',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : emlaType,
                    ValueListProperty : 'emlaType',
                },
            ],
            Label : 'EMLA Types',
        },
        Common.ValueListWithFixedValues : true,
    )
};

