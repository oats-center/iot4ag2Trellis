import Ajv from 'ajv';
const ajv = new Ajv();
/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface WaterContent {
  _id?: string;
  _rev?: number;
  _type?: "application/vnd.iot4ag.soils.water-content.1+json";
  data: {
    [k: string]: {
      deviceid: string;
      depth: {
        units: "cm" | "in";
        value: number;
        [k: string]: unknown;
      };
      time: string;
      vwc: {
        units: "%";
        value: number;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
  };
  [k: string]: unknown;
}
import { schema as schemaWaterContent } from "./schema-WaterContent.js";
const validateWaterContent = ajv.compile(schemaWaterContent);
export function assertWaterContent(o: any): asserts o is WaterContent {
  if (!validateWaterContent(o)) {
    console.log("ERROR: did not pass schema check.  Errors were:", validateWaterContent.errors);
  }
}



/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface Temperature {
  _id?: string;
  _rev?: number;
  _type?: "application/vnd.iot4ag.soils.temperature.1+json";
  data: {
    [k: string]: {
      deviceid: string;
      depth: {
        units: "cm" | "in";
        value: number;
        [k: string]: unknown;
      };
      time: string;
      temperature: {
        units: "C";
        value: number;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
  };
  [k: string]: unknown;
}
import { schema as schemaTemperature } from "./schema-Temperature.js";
const validateTemperature = ajv.compile(schemaTemperature);
export function assertTemperature(o: any): asserts o is Temperature {
  if (!validateTemperature(o)) {
    console.log("ERROR: did not pass schema check.  Errors were:", validateTemperature.errors);
  }
}



/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface Service {
  _id?: string;
  _rev?: number;
  _type?: "application/vnd.iot4ag.iot4ag2Trellis.service.1+json";
  /**
   * milliseconds
   */
  pollInterval: number;
  tables: {
    cs_6layer: {
      lastpoll_rowtime: string;
      [k: string]: unknown;
    };
    cs_surface: {
      lastpoll_rowtime: string;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
import { schema as schemaService } from "./schema-Service.js";
const validateService = ajv.compile(schemaService);
export function assertService(o: any): asserts o is Service {
  if (!validateService(o)) {
    console.log("ERROR: did not pass schema check.  Errors were:", validateService.errors);
  }
}



/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface Conductivity {
  _id?: string;
  _rev?: number;
  _type?: "application/vnd.iot4ag.soils.conductivity.1+json";
  data: {
    [k: string]: {
      deviceid: string;
      depth: {
        units: "cm" | "in";
        value: number;
        [k: string]: unknown;
      };
      time: string;
      conductivity: {
        units: "uS/cm";
        value: number;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
  };
  [k: string]: unknown;
}
import { schema as schemaConductivity } from "./schema-Conductivity.js";
const validateConductivity = ajv.compile(schemaConductivity);
export function assertConductivity(o: any): asserts o is Conductivity {
  if (!validateConductivity(o)) {
    console.log("ERROR: did not pass schema check.  Errors were:", validateConductivity.errors);
  }
}
