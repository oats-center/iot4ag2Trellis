export default {

  // /bookmarks/iot4ag/soil/water-content
  // /bookmarks/iot4ag/soil/temperature
  // /bookmarks/iot4ag/soil/conductivity
  bookmarks: {
    _type: "application/vnd.oada.bookmarks.1+json",
    iot4ag: {
      _type: "application/vnd.iot4ag.1+json",
      _rev: 0,
      soil: {
        _type: "application/vnd.iot4ag.soil.1+json",
        _rev: 0,
        "water-content": {
          _type: "application/vnd.iot4ag.soil.water-content-index.1+json",
          _rev: 0,
          'day-index': {
            '*': {
              _type: 'application/vnd.iot4ag.soil.water-content.1+json',
            }
          }
        },
        temperature: {
          _rev: 0,
          _type: "application/vnd.iot4ag.soil.temperature-index.1+json",
          'day-index': {
            '*': {
             _type: 'application/vnd.iot4ag.soil.temperature.1+json',
            },
          },
        },
        conductivity: {
          _type: "application/vnd.iot4ag.soil.conductivity-index.1+json",
          _rev: 0,
          'day-index': {
            '*': {
             _type: 'application/vnd.iot4ag.soil.conductivity.1+json',
            },
          },
        },
      },
    },

    services: {
      _type: "application/vnd.oada.services.1+json",
      _rev: 0,

      // /bookmarks/services/iot4ag2Trellis
      "iot4ag2Trellis": {
        _type: "application/vnd.iot4ag.iot4ag2Trellis.service.1+json",
      },

      // /bookmarks/services/trellis2Adc
      "trellis2Adc": {
        _type: "application/vnd.adc.trellis2Adc.service.1+json",
      },
    },

  }

}
