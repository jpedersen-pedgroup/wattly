const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const { randomUUID } = require('crypto');     // <- make sure we have a UUID

const connectionString = process.env["StorageConnection"];
const tableName = "WattlySignups";

app.http('submit-interest', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      if (!connectionString) throw new Error("Missing StorageConnection setting");
      const body = await request.json();

      const table = TableClient.fromConnectionString(connectionString, tableName);
      await table.createTable().catch(() => {}); // ignore 'already exists'

      await table.createEntity({
        partitionKey: (body.location || 'signup').toLowerCase(),
        rowKey: randomUUID(),
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
      });

      return { status: 200, headers: { 'Content-Type': 'application/json' }, body: { success: true } };
    } catch (err) {
      context.log.error('submit-interest error:', err);
      return { status: 500, headers: { 'Content-Type': 'application/json' }, body: { success: false, error: err.message } };
    }
  }
});
