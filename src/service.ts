import debug from 'debug';
import type { Service } from './builtTypes.js';
import { assertService } from './builtTypes.js';
import type { OADAClient, JsonObject } from '@oada/client';
import tree from './tree.js';

const info = debug('iot4ag2adc/service:info');
const error = debug('iot4ag2adc/service:error');

const servicePath = '/bookmarks/services/iot4ag2Trellis';
export async function getServiceInfo(oada: OADAClient): Promise<Service> {
  // Grab service info from OADA (last poll times)
  const defaultServiceInfo: Service = {
    pollInterval: process.env.POLL_INTERVAL ? +(process.env.POLL_INTERVAL) : 1000,
    tables: {
      cs_6layer: { lastpoll_rowtime: '' },
      cs_surface: { lastpoll_rowtime: '' }
    }
  }
  try {
    const response = await oada.get({ path: servicePath });
    assertService(response.data);
    return response.data;
  } catch(e: any) {
    if (e.request) delete e.request;
    if ('code' in e && e.code === '404') {
      info('Service info not present in OADA, assuming first poll time, putting default to OADA');
      await oada.put({  path: servicePath, tree, data: (defaultServiceInfo as JsonObject) });
      return defaultServiceInfo;
    } else {
      info('FAILED to retrieve or put service info from/to', servicePath, '.  Error was:', e);
      throw new Error('FAIL could not retrieve service info, and error was not 404');
    }
  }
}

export async function saveServiceInfo({ oada, service }: { oada: OADAClient, service: Service }) {
  try {
    await oada.put({ path: servicePath, tree, data: (service as JsonObject) });
  } catch(e: any) {
    error('FAIL: could not PUT to ', servicePath, '.  Error was: ', e)
  }
}
