const { app } = require('@azure/functions');

app.http('hello', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    return { status: 200, body: { text: "Hello from Azure Functions!" } };
  }
});
