const { TableClient } = require('@azure/data-tables');
const { randomUUID } = require('crypto');

module.exports = async function (context, req) {
  try {
    const conn = process.env["StorageConnection"];
    if (!conn) {
      throw new Error("Missing StorageConnection app setting");
    }

    const body = req.body || {};

    // Connect to Table Storage
    const tableName = "WattlySignups";
    const tableClient = TableClient.fromConnectionString(conn, tableName);

    // Create table if it doesn't exist
    await tableClient.createTable().catch(() => {});

    // Build entity
    const entity = {
      partitionKey: (body.location || "signup").toLowerCase(),
      rowKey: randomUUID(),
      FirstName: body.firstName || "",
      LastName: body.lastName || "",
      Email: body.email || "",
      Phone: body.phone || "",
      Role: body.role || "",
      Location: body.location || "",
      Message: body.message || "",
      Consent: !!body.consent,
      Source: body.source || "",
      UserAgent: body.userAgent || "",
      SubmittedAtUtc: new Date().toISOString()
    };

    // Save entity
    await tableClient.createEntity(entity);

    // Respond
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { success: true, message: "Signup saved" }
    };
  } catch (err) {
    context.log.error("submit-interest error:", err);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { success: false, error: err.message }
    };
  }
};
