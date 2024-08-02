import type { JSONSchema8 }  from 'jsonschema8'

export const schema: JSONSchema8 = {
  type: 'object',
  properties: {
    _id: { type: 'string' },
    _rev: { type: 'number' },
    _type: { const: 'application/vnd.iot4ag.iot4ag2Trellis.service.1+json' },

    pollInterval: { type: 'number', description: 'milliseconds' },

    tables: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          lastpoll_rowtime: { type: 'string' },
        },
        required: [ 'lastpoll_rowtime' ],
      }, 
    },
  },
  required: [ 'tables', 'pollInterval' ],

  examples: [

    {
      pollInterval: 30000,
      tables: {
        cs_6layer: { lastpoll_rowtime: '2023-07-26 23:59:33.504+00' },
        cs_surface: { lastpoll_rowtime: '2023-07-26 23:59:33.504+00' },
      },
    },

  ],

};
