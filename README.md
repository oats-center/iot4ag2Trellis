# iot4ag2Trellis

This service syncs data from the iot4ag Postgres database into OADA.  It currently
supports 3 kinds of soils data: volumetric water content, temperature, and conductivity.

## Install
----------
```bash
git clone git@github.com:oats-center/iot4ag2Trellis.git
cd iot4ag2Trellis
docker-compose up -d
```

## Published API Schemas
--------------
Tree specifying the API: [tree](src/tree.ts)

* [Soil Volumetric Water Content](./src/schema-WaterContent.ts)
* [Soil Temperature](./src/schema-WaterContent.ts)
* [Soil Conductivity](./src/schema-WaterContent.ts)

As can be seen in the tree, data is indexed by day for each data type.

Here is an example of how to get soil temperature for a particular day via the Trellis API:
`GET /bookmarks/iot4ag/soil/temperature/day-index/2024-02-24`
```json
{
  "data": {
    "2024-02-24T05:00:15.709Z-a84041fe3187bc8e": {
      "time": "2024-02-24T05:00:15.709Z",
      "deviceid": "a84041fe3187bc8e",
      "depth": {
        "value": 2,
        "units": "cm"
      },
      "temperature": {
        "value": 21.91,
        "units": "C"
      }
    },
    "2024-02-24T05:02:10.017Z-a84041703187bc93": {
      "time": "2024-02-24T05:02:10.017Z",
      "deviceid": "a84041703187bc93",
      "depth": {
        "value": 2,
        "units": "cm"
      },
      "temperature": {
        "value": 0,
        "units": "C"
      }
    }
  }
}
```


## Environment
--------------
Place in a .env file at top of project to reflect your deployment.  Note the POLL_INTERVAL_MS
will be overridden by any valid value in the service info in Trellis.
* `PGPASSWORD`
* `PGUSER`
* `PGHOST`
* `PGDATABASE`
* `PGPORT`
* `POLL_INTERVAL_MS`
* `OADA_DOMAIN`
* `OADA_TOKEN`
