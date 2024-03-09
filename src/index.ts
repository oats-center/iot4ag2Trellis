import pg from 'pg';
import sleep from 'atomic-sleep';
import type { Json } from '@oada/client';
import { connect } from '@oada/client';
import debug from 'debug';
import pmap from 'p-map'
import dotenv from 'dotenv';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import tree from './tree.js';
import { getServiceInfo } from './service.js';
import type { Conductivity, Temperature, WaterContent, Service } from './builtTypes.js';

//--------------------------------------------------
// Setup
//--------------------------------------------------

dotenv.config();
const info = debug('iot4ag2adc/index:info');
const error = debug('iot4ag2adc/index:error');

const domain = process.env.OADA_DOMAIN;
const token = process.env.OADA_TOKEN;
if (!domain) throw new Error('ERROR: you must have OADA_DOMAIN in the environment');
if (!token) throw new Error('ERROR: you must have OADA_TOKEN in the environment');

type DayIndex<T> = {
  [day: string]: T,
};
type PollResultData = {
  vwc: DayIndex<WaterContent>,
  temp: DayIndex<Temperature>,
  cond: DayIndex<Conductivity>,
}

//------------------------------------------------- 
// Connections:
//------------------------------------------------- 
const oada = await connect({ domain, token, concurrency: 1 });
info('Connected to OADA at',domain);

//------------------------------------------------ 
// Actual poll function:
//------------------------------------------------ 
let pollInterval: number = 1000; // overriden each time through poll loop by service info
async function poll() {
  info('----------------------------------------------');
  info('Starting poll run at', dayjs().toISOString())
  try {
    const service = await getServiceInfo(oada);
    pollInterval = service.pollInterval || pollInterval;
    const result: PollResultData = { vwc: {}, temp: {}, cond: {} };

    //------------------------------------------------ 
    // Poll each table
    //------------------------------------------------ 
    const reallyold = dayjs('1970-01-01');
    const maxtime_cs_6layer = await pollOneTable({ table: 'cs_6layer', result, service }) || reallyold;
    const maxtime_cs_surface = await pollOneTable({ table: 'cs_surface', result, service }) || reallyold;
    // vwc, temp, and cond are filled out now


    //---------------------------------------------------------- 
    // Put any new data we found into Trellis:
    //---------------------------------------------------------- 
    const numputs = Object.keys(result.vwc).length;
    try { 
      await pmap(Object.entries(result.vwc), async ([day, data]) => {
        const path = '/bookmarks/iot4ag/soil/water-content/day-index/'+day;
        info('Putting to '+path)
        return oada.put({ tree, path, data: data as Json });
      }, { concurrency: 1 });
      await pmap(Object.entries(result.temp), async ([day, data]) => {
        const path = '/bookmarks/iot4ag/soil/temperature/day-index/'+day;
        info('Putting to '+path)
        return oada.put({ tree, path, data: data as Json });
      }, { concurrency: 1 });
      await pmap(Object.entries(result.cond), async ([day, data]) => {
        const path = '/bookmarks/iot4ag/soil/conductivity/day-index/'+day;
        info('Putting to '+path)
        return oada.put({ tree, path, data: data as Json });
      }, { concurrency: 1 });
      info('Successfully put a total of', numputs, 'days of data to Trellis from Postgres');
    } catch(e: any) {
      if (e.request) delete e.request;
      info('FAIL: failed to put data to Trellis.  Error was: ', e);
      throw new Error('Failed to put data to Trellis');
    }

    //---------------------------------------------------------- 
    // Update poll times for our service if everything worked
    //----------------------------------------------------------  
    const tables: Json = { };
    if (maxtime_cs_6layer) {
      const str = service.tables.cs_6layer.lastpoll_rowtime;
      const s_maxtime = str ? dayjs(str) : reallyold;
      if (s_maxtime.isBefore(maxtime_cs_6layer)) {
        tables['cs_6layer'] = { lastpoll_rowtime: maxtime_cs_6layer.toISOString() };
      }
    }
    if (maxtime_cs_surface) {
      const str = service.tables.cs_surface.lastpoll_rowtime;
      const s_maxtime = str ? dayjs(str) : reallyold;
      if (s_maxtime.isBefore(maxtime_cs_surface)) {
        tables['cs_surface'] = { lastpoll_rowtime: maxtime_cs_surface.toISOString() };
      }
    }
    if (Object.keys(tables).length > 0) {
      info('Updating service with new poll times: ', tables);
      await oada.put({ tree, path: '/bookmarks/services/iot4ag2Trellis', data: { tables } });
    }
  } finally {
    info('Poll run finished');
    info('Rescheduling poll run in', pollInterval,'ms');
    info('----------------------------------------------');
    sleep(pollInterval);
    poll(); // I am not awaiting/returning poll so the recursion stack doesn't grow to infinity
  }
}

//------------------------------------------------- 
// Poll one table
//------------------------------------------------- 
async function pollOneTable({table, result, service}: {
  table: 'cs_6layer' | 'cs_surface',
  result: PollResultData,
  service: Service,
}): Promise<Dayjs | null> { // returns maxpolltime from the rows
  let pgclient: pg.Client;
  try {
    pgclient = new pg.Client();
    await pgclient.connect();
  } catch(e: any) {
    error('ERROR: failed to connect to Postgres.  Error was: ', e);
    throw new Error('Failed to connect to Postgres.');
  };

  let q = '';
  try {
    //---------------------------------------------------- 
    // Construct query
    //---------------------------------------------------- 
    const tinfo = service.tables[table] as object;
    const lastpoll_rowtime = tinfo && 'lastpoll_rowtime' in tinfo ? tinfo.lastpoll_rowtime : '';
    q = `SELECT * FROM ${table}`;
    if (lastpoll_rowtime) {
      q += ` WHERE time > '${lastpoll_rowtime}'`;
    }
    q += ' ORDER BY time ASC LIMIT 1000';
    const resp = await pgclient.query(q);
    if (!resp.rows || resp.rows.length < 1) {
      info('No new rows found for', table);
      return null;
    }
    info('Found',resp.rows.length,'new rows in',table);
    
    //---------------------------------------------------- 
    // Map postgres result into Trellis, return max poll times from rows
    //---------------------------------------------------- 
    return rowsToPollResultData({ table, rows: resp.rows, result });

  } catch(err: any) {
    if (err.request) delete err.request; // print things cleaner
    info('ERROR: failed to poll for new rows. Query was: ', q, ', err = ', err);
    throw ('ERROR: could not poll postgress')
  } finally {
    await pgclient.end();
  }

}


//--------------------------------------------------- 
// Map Postgress rows into Trellis data
//--------------------------------------------------- 

function rowsToPollResultData(
  {table, rows, result}: 
  { table: string, rows: any[], result: PollResultData }
): Dayjs | null { // Returns max time from all the rows
  const { vwc, temp, cond } = result;
  const pg2TrellisMap = {
    'vwc'  : { depth:   2, key: 'vwc', units: '%', bucket: vwc },
    'vwc_1': { depth:   2, key: 'vwc', units: '%', bucket: vwc },
    'vwc_2': { depth:  20, key: 'vwc', units: '%', bucket: vwc },
    'vwc_3': { depth:  40, key: 'vwc', units: '%', bucket: vwc },
    'vwc_4': { depth:  60, key: 'vwc', units: '%', bucket: vwc },
    'vwc_5': { depth:  80, key: 'vwc', units: '%', bucket: vwc },
    'vwc_6': { depth: 100, key: 'vwc', units: '%', bucket: vwc },
    'temp_c'  : { depth:   2, key: 'temperature', units: 'C', bucket: temp },
    'temp_c_1': { depth:   2, key: 'temperature', units: 'C', bucket: temp },
    'temp_c_2': { depth:  20, key: 'temperature', units: 'C', bucket: temp },
    'temp_c_3': { depth:  40, key: 'temperature', units: 'C', bucket: temp },
    'temp_c_4': { depth:  60, key: 'temperature', units: 'C', bucket: temp },
    'temp_c_5': { depth:  80, key: 'temperature', units: 'C', bucket: temp },
    'temp_c_6': { depth: 100, key: 'temperature', units: 'C', bucket: temp },
    'conduct_us_cm': { depth: 2, key: 'conductivity', units: 'uS/cm', bucket: cond },
  };
  let maxtime: Dayjs | null = null;
  for (const [rownum, r] of rows.entries()) {
    if (!r) throw new Error('Row '+rownum+' failed: row is falsey')

    if (!(r.time instanceof Date)) throw new Error('Row '+rownum+' failed: time ('+(JSON.stringify(r.time))+') is not a Date');
    const date = dayjs(r.time);
    if (!date || !date.isValid()) throw new Error('Row '+rownum+' failed: dayjs(time) is not valid');
    if (date.year() < 2020) {
      info('Skipping data with very old date: ', date.toISOString());
      continue;
    }
    const day = date.format('YYYY-MM-DD');
    const time = date.toISOString();
    if (!maxtime) maxtime = date;
    if (maxtime.isBefore(date)) maxtime = date;

    if (typeof r.device_eui !==  'string') throw new Error('Row '+rownum+' failed: device_euid is not a string');
    const deviceid = r.device_eui;

    // a repeatable, unique id for this sample
    const sampleid = time+'-'+deviceid;

    const base = { time, deviceid };

    for (const [dbkey, info] of Object.entries(pg2TrellisMap)) {
      if (typeof r[dbkey] === 'number')  {
        if (!info.bucket[day]) info.bucket[day] = { data: {} };
        // @ts-ignore
        info.bucket[day].data[sampleid] = { 
          ...base,
          depth: { value: info.depth, units: 'cm' }, // cs_surface is only table with conductivity
          [info.key]: { 
            value: r[dbkey],
            units: info.units,
          }
        };
      }
    }
  }
  return maxtime;
}

//------------------------------------------------ 
// Do the polling, poll function will reschedule itself in "finally"
//------------------------------------------------ 
await poll();



