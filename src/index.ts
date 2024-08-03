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
import { getTableConfigs } from './pgsetup.js';
import type {  TableConfig } from './pgsetup.js';
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
const lastrev_syncoverride_mode = process.env.LASTREV_SYNCOVERRIDE || null;

export type DayIndex<T> = {
  [day: string]: T,
};
export type PollResultData = {
  vwc: DayIndex<WaterContent>,
  temp: DayIndex<Temperature>,
  cond: DayIndex<Conductivity>,
}

//------------------------------------------------- 
// Connections:
//------------------------------------------------- 
const oada = await connect({ domain, token, concurrency: 1 });
info('Connected to OADA at',domain, 'with token', token);

//------------------------------------------------ 
// Actual poll function:
//------------------------------------------------ 
let pollInterval: number = 1000; // overriden each time through poll loop by service info
async function poll() {
  info('----------------------------------------------');
  info('Starting poll run at', dayjs().toISOString())
  try {
    const result: PollResultData = { vwc: {}, temp: {}, cond: {} };
    // Get the tables we need to poll in PG and wire up to the result buckets:
    const tableConfigs = getTableConfigs(result);

    // Grab the latest service info:
    const service = await getServiceInfo({tableConfigs, oada});
    pollInterval = service.pollInterval || pollInterval;
    //------------------------------------------------ 
    // Poll each table
    //------------------------------------------------ 
    const maxtimes: {tablename: string, maxtime: Dayjs}[] = [];
    for (const tableinfo of tableConfigs) {
      const maxtime = await pollOneTable({ tableinfo, result, service }) || dayjs('1970-01-01');
      maxtimes.push({ tablename: tableinfo.table, maxtime });
    }

    // vwc, temp, and cond are filled out now from postgres


    //---------------------------------------------------------- 
    // Put any new data we found into Trellis:
    //---------------------------------------------------------- 
    const numputs = Object.keys(result.vwc).length;
    try { 
      await pmap(Object.entries(result.vwc), async ([day, data]) => {
        const path = '/bookmarks/iot4ag/soil/water-content/day-index/'+day;
        return putToOADA({ path, data: data as Json});
      }, { concurrency: 1 });
      await pmap(Object.entries(result.temp), async ([day, data]) => {
        const path = '/bookmarks/iot4ag/soil/temperature/day-index/'+day;
        return putToOADA({ path, data: data as Json });
      }, { concurrency: 1 });
      await pmap(Object.entries(result.cond), async ([day, data]) => {
        const path = '/bookmarks/iot4ag/soil/conductivity/day-index/'+day;
        return putToOADA({ path, data: data as Json });
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
    for (const tableinfo of tableConfigs) {
      const maxtime = maxtimes.find(m => m.tablename === tableinfo.table)?.maxtime;
      if (!maxtime) throw new Error('ERROR: maxtime not found for table '+tableinfo.table);
      const str = service.tables[tableinfo.table]?.lastpoll_rowtime;
      const s_maxtime = str ? dayjs(str) : dayjs('1970-01-01');
      if (s_maxtime.isBefore(maxtime)) { // this poll had a newer row than last time, so update Trellis for it:
        tables[tableinfo.table] = { lastpoll_rowtime: maxtime.toISOString() };
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
async function pollOneTable({tableinfo, result, service}: {
  tableinfo: TableConfig,
  result: PollResultData,
  service: Service,
}): Promise<Dayjs | null> { // returns maxpolltime from the rows
  let pgclient: pg.Client;
  try {
    const connectinfo = {
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      host: process.env.PGHOST,
      port: +(process.env.PGPORT || 5431),
      database: process.env.PGDATABASE,
    };
    if (tableinfo.db === 'old') {
      connectinfo.user = process.env.OLDPGUSER;
      connectinfo.password = process.env.OLDPGPASSWORD;
      connectinfo.host = process.env.OLDPGHOST;
      connectinfo.port = +(process.env.OLDPGPORT || 5431);
      connectinfo.database = process.env.OLDPGDATABASE;
    }
    pgclient = new pg.Client(connectinfo);
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
    const svc_tinfo = service.tables[tableinfo.table] as object;
    const lastpoll_rowtime = svc_tinfo && 'lastpoll_rowtime' in svc_tinfo ? svc_tinfo.lastpoll_rowtime : '';
    q = `SELECT * FROM ${tableinfo.table}`;
    if (lastpoll_rowtime) {
      q += ` WHERE ${tableinfo.timeColumn} > '${lastpoll_rowtime}'`;
    }
    q += ` ORDER BY ${tableinfo.timeColumn} ASC LIMIT 1000`;
    const resp = await pgclient.query(q);
    if (!resp.rows || resp.rows.length < 1) {
      info('No new rows found for', tableinfo.table);
      return null;
    }
    info('Found',resp.rows.length,'new rows in',tableinfo.table);
    
    //---------------------------------------------------- 
    // Map postgres result into Trellis, return max poll times from rows
    //---------------------------------------------------- 
    return rowsToPollResultData({ tableinfo, rows: resp.rows, result });

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
  {tableinfo, rows, result}: 
  {tableinfo: TableConfig, rows: any[], result: PollResultData }
): Dayjs | null { // Returns max time from all the rows
  const { vwc, temp, cond } = result;
  let maxtime: Dayjs | null = null;
  for (const [rownum, r] of rows.entries()) {
    if (!r) throw new Error('Row '+rownum+' failed: row is falsey')

    const ts = r[tableinfo.timeColumn];
    if (!(ts instanceof Date)) throw new Error('Row '+rownum+' failed: time or ts ('+(JSON.stringify(ts))+') is not a Date');
    const date = dayjs(ts);
    if (!date || !date.isValid()) throw new Error('Row '+rownum+' failed: dayjs(time) is not valid');
    if (date.year() < 2020) {
      info('Skipping data with very old date: ', date.toISOString());
      continue;
    }
    const day = date.format('YYYY-MM-DD');
    const time = date.toISOString();
    if (!maxtime) maxtime = date;
    if (maxtime.isBefore(date)) maxtime = date;

    const deviceid = r[tableinfo.deviceidColumn];
    if (typeof deviceid !==  'string') throw new Error('Row '+rownum+' failed: device_euid or device_id is not a string');

    // a repeatable, unique id for this sample
    const sampleid = time+'-'+deviceid;

    const base = { time, deviceid };

    for (const [dbkey, info] of Object.entries(tableinfo.dataColumns)) {
      if (typeof r[dbkey] === 'number')  {
        if (!info.bucket[day]) info.bucket[day] = { data: {} };
        let depthvalue = +(r[tableinfo.depthColumn || ''] || 0);
        if (info.depth) { // can override from column info with a constant if no depth column exists in DB (old DB style)
          depthvalue = info.depth;
        }
        if (typeof depthvalue !== 'number') throw new Error('Row '+rownum+' failed: either no depth column exists or depth in column info is not a number');
        // @ts-ignore
        info.bucket[day].data[sampleid] = { 
          ...base,
          depth: { value: depthvalue, units: 'cm' }, // cs_surface is only table with conductivity
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
// Put to OADA: wrapper to add support for lastrev_syncoverride_mode
//-----------------------------------------------
async function putToOADA({path, data}: {path: string, data: Json}): Promise<any> {
  info('Putting to '+path)
  const result = await oada.put({ tree, path, data: data as Json });
  if (lastrev_syncoverride_mode) {
    let rev = +(result.headers['x-oada-rev'] || 0);
    const resourceidpath = result.headers['content-location'];
    if (!rev) throw new Error('No x-oada-rev found in headers when putting to '+path);
    if (!resourceidpath) throw new Error('No content-location found in headers when putting to '+path);
    const metapath = resourceidpath + '/_meta';
    rev++; // Note: the write to OADA for this _meta will increment the rev, so we have to put the incremented rev
    //info('We are in lastrev_syncoverride_mode, so we going to put the latest rev '+rev+' back to '+metapath);
    await oada.put({ path: metapath, data: { lastrev_syncoverride: rev } });
  }
}


//------------------------------------------------ 
// Do the polling, poll function will reschedule itself in "finally"
//------------------------------------------------ 
await poll();



