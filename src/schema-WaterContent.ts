import type { JSONSchema8 }  from 'jsonschema8'

export const schema: JSONSchema8 = {
  type: 'object',
  properties: {
    _id: { type: 'string' },
    _rev: { type: 'number' },
    _type: { const: 'application/vnd.iot4ag.soils.water-content.1+json' },
    data: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {

          deviceid: { type: 'string' },

          depth: { 
            type: 'object', 
            properties: {
              units: { enum: ['cm','in'] },
              value: { type: 'number' },
            }, required: [ 'units', 'value' ],
          },

          time: { type: 'string' },

          vwc: { 
            type: 'object',
            properties: {
              units: { enum: [ '%' ] },
              value: { type: 'number' },
            }, required: [ 'units', 'value' ],
          },

        },
        required: [ 'deviceid', 'depth', 'time', 'vwc' ],

      }
    }
  },
  required: [ 'data' ],

  examples: [
    {
      data: {
        '0kjf20ijfklsdfj': { 
          time: '2023-07-26 23:59:33.504+00',
          deviceid: '0d2ijfkldjflkds',
          depth: { value: 2, units: 'cm' },
          vwc: { value: 18.4, units: '%' },
        }
      }
    },
  ],

};
