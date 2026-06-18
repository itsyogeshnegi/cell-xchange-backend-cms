import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Cell Xchange API',
    version: '1.0.0',
    description: 'API documentation for the Cell Xchange CMS, CRM, inventory, billing, and reporting backend.',
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['super_admin', 'admin', 'staff'] },
          token: { type: 'string' },
        },
      },
      MessageResponse: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          fullName: { type: 'string' },
          phone: { type: 'string' },
          alternatePhone: { type: 'string' },
          gender: { type: 'string' },
          address: { type: 'string' },
        },
      },
      InventoryItem: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          productType: { type: 'string' },
          brand: { type: 'string' },
          model: { type: 'string' },
          imei1: { type: 'string' },
          serialNumber: { type: 'string' },
          condition: { type: 'string' },
          purchasePrice: { type: 'number' },
          sellingPrice: { type: 'number' },
          deviceStatus: { type: 'string' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          title: { type: 'string' },
          category: { type: 'string' },
          brand: { type: 'string' },
          model: { type: 'string' },
          price: { type: 'number' },
          condition: { type: 'string' },
          isFeatured: { type: 'boolean' },
          isPublished: { type: 'boolean' },
        },
      },
      Settings: {
        type: 'object',
        properties: {
          shopName: { type: 'string' },
          gstNumber: { type: 'string' },
          address: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          invoicePrefix: { type: 'string' },
          purchasePrefix: { type: 'string' },
          theme: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate a user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Authenticated user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' },
              },
            },
          },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/auth/profile': {
      get: {
        tags: ['Auth'],
        summary: 'Get the logged-in user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'User profile loaded' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/auth/change-password': {
      put: {
        tags: ['Auth'],
        summary: 'Change the logged-in user password',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Password updated' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/customers': {
      get: {
        tags: ['Customers'],
        summary: 'List customers',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Paginated customer list' },
        },
      },
      post: {
        tags: ['Customers'],
        summary: 'Create a customer',
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: 'Customer created' },
        },
      },
    },
    '/api/customers/{id}': {
      get: {
        tags: ['Customers'],
        summary: 'Get one customer with transaction history',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Customer detail loaded' },
        },
      },
      put: {
        tags: ['Customers'],
        summary: 'Update a customer',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Customer updated' },
        },
      },
      delete: {
        tags: ['Customers'],
        summary: 'Delete a customer',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Customer deleted' },
          403: { description: 'Forbidden for current role' },
        },
      },
    },
    '/api/inventory': {
      get: {
        tags: ['Inventory'],
        summary: 'List inventory items',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Paginated inventory list' },
        },
      },
      post: {
        tags: ['Inventory'],
        summary: 'Create an inventory item',
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: 'Inventory item created' },
        },
      },
    },
    '/api/inventory/export': {
      get: {
        tags: ['Inventory'],
        summary: 'Export inventory to Excel',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Excel export stream' },
        },
      },
    },
    '/api/inventory/import': {
      post: {
        tags: ['Inventory'],
        summary: 'Import inventory from Excel',
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: 'Inventory import processed' },
        },
      },
    },
    '/api/inventory/{id}': {
      get: {
        tags: ['Inventory'],
        summary: 'Get one inventory item',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Inventory item loaded' } },
      },
      put: {
        tags: ['Inventory'],
        summary: 'Update an inventory item',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Inventory item updated' } },
      },
      delete: {
        tags: ['Inventory'],
        summary: 'Delete an inventory item',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Inventory item deleted' } },
      },
    },
    '/api/sales': {
      get: {
        tags: ['Sales'],
        summary: 'List sales',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Sales list loaded' } },
      },
      post: {
        tags: ['Sales'],
        summary: 'Create a sale',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Sale created' } },
      },
    },
    '/api/sales/{id}': {
      get: {
        tags: ['Sales'],
        summary: 'Get one sale',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Sale loaded' } },
      },
    },
    '/api/sales/{id}/pdf': {
      get: {
        tags: ['Sales'],
        summary: 'Open A4 invoice PDF',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'PDF stream returned' } },
      },
    },
    '/api/sales/{id}/thermal': {
      get: {
        tags: ['Sales'],
        summary: 'Open thermal receipt PDF',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'PDF stream returned' } },
      },
    },
    '/api/purchases': {
      get: {
        tags: ['Purchases'],
        summary: 'List purchases',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Purchases list loaded' } },
      },
      post: {
        tags: ['Purchases'],
        summary: 'Create a purchase voucher',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Purchase created' } },
      },
    },
    '/api/purchases/{id}': {
      get: {
        tags: ['Purchases'],
        summary: 'Get one purchase',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Purchase loaded' } },
      },
    },
    '/api/purchases/{id}/pdf': {
      get: {
        tags: ['Purchases'],
        summary: 'Open purchase voucher PDF',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'PDF stream returned' } },
      },
    },
    '/api/cms/public/homepage': {
      get: {
        tags: ['CMS'],
        summary: 'Get public homepage content',
        responses: { 200: { description: 'Homepage content loaded' } },
      },
    },
    '/api/cms/public/products': {
      get: {
        tags: ['CMS'],
        summary: 'Get published public products',
        responses: { 200: { description: 'Public catalog products loaded' } },
      },
    },
    '/api/cms/products': {
      get: {
        tags: ['CMS'],
        summary: 'List CMS products',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'CMS products loaded' } },
      },
      post: {
        tags: ['CMS'],
        summary: 'Create a CMS product',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'CMS product created' } },
      },
    },
    '/api/cms/homepage': {
      get: {
        tags: ['CMS'],
        summary: 'Get admin homepage CMS settings',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'CMS homepage settings loaded' } },
      },
      put: {
        tags: ['CMS'],
        summary: 'Update homepage CMS settings',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'CMS homepage updated' } },
      },
    },
    '/api/analytics/summary': {
      get: {
        tags: ['Analytics'],
        summary: 'Get dashboard summary metrics',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Dashboard summary loaded' } },
      },
    },
    '/api/analytics/charts': {
      get: {
        tags: ['Analytics'],
        summary: 'Get analytics chart datasets',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Analytics chart data loaded' } },
      },
    },
    '/api/reports': {
      get: {
        tags: ['Reports'],
        summary: 'Get report data',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Report data loaded' } },
      },
    },
    '/api/reports/export': {
      get: {
        tags: ['Reports'],
        summary: 'Export report to Excel',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Excel report stream' } },
      },
    },
    '/api/settings': {
      get: {
        tags: ['Settings'],
        summary: 'Get store settings',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Settings loaded' } },
      },
      put: {
        tags: ['Settings'],
        summary: 'Update store settings',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Settings updated' } },
      },
    },
    '/api/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List recent notifications',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Notifications loaded' } },
      },
    },
    '/api/notifications/read': {
      put: {
        tags: ['Notifications'],
        summary: 'Mark all notifications as read',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Notifications updated' } },
      },
    },
    '/api/audit-logs': {
      get: {
        tags: ['Audit Logs'],
        summary: 'Get audit logs',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Audit logs loaded' } },
      },
    },
  },
  tags: [
    { name: 'Auth' },
    { name: 'Customers' },
    { name: 'Inventory' },
    { name: 'Sales' },
    { name: 'Purchases' },
    { name: 'CMS' },
    { name: 'Analytics' },
    { name: 'Reports' },
    { name: 'Settings' },
    { name: 'Notifications' },
    { name: 'Audit Logs' },
  ],
};

export const swaggerSpec = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: [],
});

export const swaggerUiOptions = {
  explorer: true,
  customSiteTitle: 'Cell Xchange API Docs',
};
