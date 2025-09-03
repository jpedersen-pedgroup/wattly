// Azure Function to handle Wattly signups (JavaScript)
// Saves submissions into Azure Table Storage

// File: api/submit-interest/index.js

const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');

const connectionString = process.env["StorageConnection"];
const tableName = "WattlySignups";

app.http('submit-interest', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      context.log('New signup received:', body);

      if (!connectionString) {
        throw new Error("Missing StorageConnection setting");
      }

      const tableClient = TableClient.fromConnectionString(connectionString, tableName);
      await tableClient.createTable({ onResponse: () => {} }).catch(() => {});

      const entity = {
        partitionKey: (body.location || 'signup').toLowerCase(),
        rowKey: crypto.randomUUID(),
        FirstName: body.firstName || '',
        LastName: body.lastName || '',
        Email: body.email || '',
        Phone: body.phone || '',
        Role: body.role || '',
        Location: body.location || '',
        Message: body.message || '',
        Consent: !!body.consent,
        Source: body.source || '',
        UserAgent: body.userAgent || '',
        SubmittedAtUtc: new Date().toISOString()
      };

      await tableClient.createEntity(entity);

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { success: true, message: 'Signup saved' }
      };
    } catch (err) {
      context.log.error('Error processing signup', err);
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: err.message }
      };
    }
  }
});

/*
How to use:
1. Create a folder `api/submit-interest/` in your repo.
2. Add this file as `index.js`.
3. In Azure Portal → your Static Web App → Configuration, add an app setting:
   Name: StorageConnection
   Value: <your storage account connection string>
4. Azure Static Web Apps will deploy it as an API endpoint at
   https://<yoursite>.azurestaticapps.net/api/submit-interest
5. In your index.html form handler, set:
   const ENDPOINT = '/api/submit-interest';
*/
