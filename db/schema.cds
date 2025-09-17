namespace EMLATracker;

entity EMLACustomers
{
    key ID : UUID;
    externalID : String(40);
    customerName: String(250);
    customerNumber: String(20);
    emlaType: String(50);
    region: String(25);
    country: String(25);
    startDateL: Date;
    btpOnbAdvNome: String(100);
    btpOnbAdvEmail: String(100);
    Status: String(100);
}