<template>
  <div class="bg-primary">
    <q-toolbar
      v-if="title || closable"
      class="bg-primary text-white"
    >
      <q-toolbar-title style="font-size:1em">
        <span>{{ title }}</span>
        <q-tooltip>
          {{ displayType }}
        </q-tooltip>
      </q-toolbar-title>
      <q-btn
        v-if="closable"
        round dense flat
        size="sm"
        @click="$emit('closing')"
      >
        <q-icon name="cancel" size="14px" />
      </q-btn>
    </q-toolbar>

    <form>
      <div class="column q-gutter-y-md">
        <div>
          <div v-if="radius !== null" class="text-bold">Center:</div>
          <q-table
            dense
            :data="tableData"
            :columns="columns"
            row-key="index"
            :rows-per-page-options="rowsPerPage"
            :pagination.sync="pagination"
            hide-bottom
          >
            <template v-slot:body="props">
              <q-tr :props="props"
                    @mouseover.native="mousePos(props.row)" @mouseout.native="mousePos()"
              >
                <q-td key="centerCol" :props="props"
                      style="width:1px; padding:0"
                >
                  <q-btn
                    round dense flat
                    size="sm"
                    @click="centerMapAt(props.row)"
                  >
                    <q-icon name="album" size="12px" />
                    <q-tooltip :delay="2000">
                      Center map at this position
                    </q-tooltip>
                  </q-btn>
                </q-td>

                <q-td
                  key="latitude" :props="props"
                  style="white-space:nowrap;width:5px"
                >
                  <div :class="{'bg-green-1': editable}">
                    {{ props.row.latitude && props.row.latitude.toFixed(4) || '' }}
                    <q-popup-edit
                      v-if="editable"
                      title="latitude"
                      v-model="props.row.latitude"
                      buttons
                    >
                      <q-input
                        type="number"
                        v-model.number="props.row.latitude"
                        dense autofocus filled
                      />
                    </q-popup-edit>
                  </div>
                </q-td>

                <q-td
                  key="longitude" :props="props"
                  style="white-space:nowrap;width:5px;padding-right:4px"
                >
                  <div :class="{'bg-green-1': editable}">
                    {{ props.row.longitude && props.row.longitude.toFixed(4) || ''}}
                    <q-popup-edit
                      v-if="editable"
                      title="longitude"
                      v-model="props.row.longitude"
                      buttons
                    >
                      <q-input
                        type="number"
                        v-model.number="props.row.longitude"
                        dense autofocus filled
                      />
                    </q-popup-edit>
                  </div>
                </q-td>
              </q-tr>
            </template>
          </q-table>
        </div>

        <div
          v-if="radius !== null"
          class="row items-center q-gutter-xs bg-white shadow-2 q-pr-sm"
        >
          <div class="text-bold">Radius:</div>
          <div class="">
            {{ radius && radius.toFixed(2) || radius }}
            <q-popup-edit
              v-model="radius"
              :validate="radiusValidation"
              buttons
            >
              <q-input
                type="number"
                v-model.number="radius"
                :error="errorRadius"
                :error-message="errorMessageRadius"
                dense autofocus filled
              />
            </q-popup-edit>
          </div>
          <div>m</div>
        </div>

        <q-dialog v-if="debugFeature" value seamless :position="debugFeature">
          <q-scroll-area style="height:700px;width:300px" class="bg-grey-1 shadow-7">
            <pre style="font-size:0.8em" class="q-pa-md"
            >coords-table feature={{feature}}</pre>
          </q-scroll-area>
        </q-dialog>
      </div>
    </form>
  </div>
</template>

<script>
  import cloneDeep from 'lodash/cloneDeep'
  import isEqual from 'lodash/isEqual'
  import map from 'lodash/map'
  import get from 'lodash/get'
  import set from 'lodash/set'
  import filter from 'lodash/filter'

  const debug = window.location.search.match(/.*debug=.*qgeomap.*/)

  export default {
    name: 'coords-table',

    props: {
      title: {
        type: String,
        default: '',
      },

      feature: {
        type: Object,
        required: true,
      },

      editable: {
        type: Boolean,
        default: false
      },

      closable: {
        type: Boolean,
        default: false
      },

      debugFeature: {
        type: String,  // position
        default: null
      },
    },

    computed: {
      displayType() {
        const hasRadius = get(this.feature, 'properties.radius')
        return hasRadius ? 'Circle'
            : get(this.feature, 'geometry.type') || this.feature.type || '??'
      },
    },

    data: () => ({
      debug,

      originalFeature: null,

      error: null,
      status: null,

      tableData: [],
      columns: [
        {name: 'centerCol', field: 'centerCol', label: '', align: 'center'},
        {name: 'latitude', field: 'latitude', label: 'Lat', align: 'left'},
        {name: 'longitude', field: 'longitude', label: 'Lon', align: 'left'},
      ],
      rowsPerPage: [0],
      pagination: {
        rowsPerPage: 0
      },

      radius: null,
      errorRadius: false,
      errorMessageRadius: null,
    }),

    mounted() {
      this.reflectInputs()
    },

    methods: {
      reflectInputs() {
        if (debug) console.log('reflectInputs:', 'feature=', this.feature, 'title=', this.title)

        this.originalFeature = cloneDeep(this.feature)

        this.status = null
        this.error = null

        this.tableData = this.getTableData()
      },

      getTableData() {
        // console.log('getTableData: feature=', cloneDeep(this.feature))

        const feature = normalizeFeature(this.feature)
        // console.log(`getTableData:`,
        //     'feature.type=', this.feature.type,
        //     'feature.geometry=', this.feature.geometry,
        //     'feature.geometry.type=', this.feature.geometry && this.feature.geometry.type,
        //     'feature.geometry.coordinates=', this.feature.geometry && this.feature.geometry.coordinates
        // )

        this.radius = null
        let list = []
        if (feature && feature.geometry) {
          switch (feature.geometry.type) {
            case 'Polygon': {
              list = feature.geometry.coordinates[0]
              break
            }

            case 'LineString': {
              list = feature.geometry.coordinates
              break
            }

            case 'Point': {
              list = [feature.geometry.coordinates]

              this.radius = get(feature, 'properties.radius') || null
              break
            }

            case 'MultiPoint': {
              if (debug) console.log('::::MultiPoint feature=', feature)
              list = feature.geometry.coordinates
              break
            }
          }
        }
        return map(list, ([longitude, latitude], index) => ({
          index, latitude, longitude,
        }))
      },

      updateFeature() {
        if (debug) console.log('updateFeature, this.feature=', this.feature)

        const lonlats = map(this.tableData, ({latitude, longitude}) =>
          [longitude, latitude]
        )

        let updatedFeature = normalizeFeature(this.feature)

        if (this.feature.geometry) {
          switch (this.feature.geometry.type) {
            case 'Polygon': {
              updatedFeature.geometry.coordinates[0] = lonlats
              break
            }

            case 'LineString': {
              updatedFeature.geometry.coordinates = lonlats
              break
            }

            case 'Point': {
              updatedFeature.geometry.coordinates = lonlats[0]
              if (this.radius !== null && this.radius > 0) {
                set(updatedFeature, 'properties.radius', +this.radius.toFixed(2))
              }
              break
            }

            case 'MultiPoint': {
              updatedFeature.geometry.coordinates = lonlats
              break
            }
          }
        }

        if (!isEqual(updatedFeature, this.feature)) {
          this.$emit('updatedFeature', updatedFeature)
        }
      },

      centerMapAt(row) {
        const lat = row && row.latitude
        const lon = row && row.longitude
        if (lat !== undefined && lon !== undefined) {
          this.$emit('centerMapAt', [lat, lon])
        }
      },

      mousePos(row) {
        const lat = row && row.latitude
        const lon = row && row.longitude
        const latLon = lat !== undefined && lon !== undefined ? [lat, lon] : null
        this.$emit('mousePos', latLon)
      },

      radiusValidation(val) {
        if (val <= 0) {
          this.errorRadius = true
          this.errorMessageRadius = 'The value must positive'
          return false
        }
        this.errorRadius = false
        this.errorMessageRadius = ''
        return true
      },
    },

    watch: {
      feature() {
        this.reflectInputs()
      },

      tableData: {
        handler() {
          this.updateFeature()
        },
        deep: true,
      },

      radius() {
        this.updateFeature()
      },
    },
  }

  function normalizeFeature(feature) {
    if (feature && feature.type === 'FeatureCollection') {
      return convertFeatureCollection(feature)
    }
    else return cloneDeep(feature)
  }

  function convertFeatureCollection(feature) {
    if (debug) console.log('convertFeatureCollection feature=', feature)
    const geometries = map(feature.features, 'geometry')
    const points = filter(geometries, {type: 'Point'})
    if (debug) console.warn('convertFeatureCollection', 'points=', points)

    // all 'Point's?
    if (points && points.length && geometries.length) {
      const lonlats = map(points, 'coordinates')
      return {
        type: 'Feature',
        geometry: {
          type: 'MultiPoint',
          coordinates: lonlats
        },
      }
    }
    // TODO other cases: collection of Polygon, etc
  }
</script>

<style scoped>
  .error {
    font-size: smaller;
    color: darkred;
  }
</style>
