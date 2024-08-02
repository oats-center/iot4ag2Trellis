import type { PollResultData } from './index.js';
export type TableConfig = {
  table: string,
  db: 'old' | 'new',
  timeColumn: string,
  deviceidColumn: string,
  depthColumn?: string,
  dataColumns: { 
    [key: string]: { 
      depth?: number, 
      key: string, 
      units: string, 
      bucket: PollResultData['vwc'] | PollResultData['temp'] | PollResultData['cond'],
    },
  },
};
// Pass in the "buckets" for the different kind of data in "results"
export function getTableConfigs(result: PollResultData): TableConfig[] {
  const { vwc, temp, cond } = result;
  return [
    {
      table: 'cs_surface',
      db: 'old',
      timeColumn: 'time',
      deviceidColumn: 'device_eui',
      dataColumns: { 
                  'vwc': { depth: 2, key: 'vwc', units: '%', bucket: vwc }, // new tables will override this depth with the one on each row
               'temp_c': { depth: 2, key: 'temperature', units: 'C', bucket: temp }, // new tables will override this depth with the one on each row
        'conduct_us_cm': { depth: 2, key: 'conductivity', units: 'uS/cm', bucket: cond },
      },
    },

    {
      table: 'cs_6layer',
      db: 'old',
      timeColumn: 'time',
      deviceidColumn: 'device_eui',
      dataColumns: {
           'vwc_1': { depth:   2, key: 'vwc', units: '%', bucket: vwc },
           'vwc_2': { depth:  20, key: 'vwc', units: '%', bucket: vwc },
           'vwc_3': { depth:  40, key: 'vwc', units: '%', bucket: vwc },
           'vwc_4': { depth:  60, key: 'vwc', units: '%', bucket: vwc },
           'vwc_5': { depth:  80, key: 'vwc', units: '%', bucket: vwc },
           'vwc_6': { depth: 100, key: 'vwc', units: '%', bucket: vwc },
        'temp_c_1': { depth:   2, key: 'temperature', units: 'C', bucket: temp },
        'temp_c_2': { depth:  20, key: 'temperature', units: 'C', bucket: temp },
        'temp_c_3': { depth:  40, key: 'temperature', units: 'C', bucket: temp },
        'temp_c_4': { depth:  60, key: 'temperature', units: 'C', bucket: temp },
        'temp_c_5': { depth:  80, key: 'temperature', units: 'C', bucket: temp },
        'temp_c_6': { depth: 100, key: 'temperature', units: 'C', bucket: temp },
      }
    },

    {
      table: 'soil_temp',
      db: 'new',
      timeColumn: 'ts',
      deviceidColumn: 'device_id',
      depthColumn: 'depth_cm',
      dataColumns: { // depth is in the column itself
        'temp_c': { key: 'temperature', units: 'C', bucket: temp }, // new tables will override this depth with the one on each row
      },
    },

    {
      table: 'soil_moisture',
      db: 'new',
      timeColumn: 'ts',
      depthColumn: 'depth_cm',
      deviceidColumn: 'device_id',
      dataColumns: {
        'vwc': { key: 'vwc', units: '%', bucket: vwc }, // new tables will override this depth with the one on each row
      },
    },

  ];
}
