<template>
  <div class="bg-blue-1 q-pb-xs">
    <q-toolbar class="bg-primary text-white q-mb-sm">
      <q-toolbar-title style="font-size:1.1em">
        {{ entry.entry_id }}
      </q-toolbar-title>
      <div class="text-grey-2" style="font-size:0.8em">{{ displayType }}</div>
    </q-toolbar>

    <form class="q-ma-xs">

      <div class="column q-gutter-md">
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
                      style="width:1px"
                >
                  <q-btn
                    round dense
                    size="xs" class="q-mr-xs"
                    @click="centerMapAt(props.row)"
                  >
                    <q-icon name="album" size="12px" />
                    <q-tooltip :delay="2000">
                      Center map at this position
                    </q-tooltip>
                  </q-btn>
                </q-td>

                <q-td key="latitude" :props="props"
                      style="white-space:nowrap;width:5px"
                >{{ props.row.latitude && props.row.latitude.toFixed(4) || '' }}
                  <q-popup-edit
                    v-if="editable"
                    v-model="props.row.latitude"
                    buttons
                  >
                    <q-input
                      type="number"
                      v-model.number="props.row.latitude"
                      dense autofocus filled
                    />
                  </q-popup-edit>
                </q-td>

                <q-td key="longitude" :props="props"
                      style="white-space:nowrap;width:5px"
                >{{ props.row.longitude && props.row.longitude.toFixed(4) || ''}}
                  <q-popup-edit
                    v-model="props.row.longitude"
                    buttons
                  >
                    <q-input
                      type="number"
                      v-model.number="props.row.longitude"
                      dense autofocus filled
                    />
                  </q-popup-edit>
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

        <pre
          v-if="debug"
          style="font-size: smaller" class="bg-grey-1"
        >feature={{feature}}</pre>
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

  const debug = true//window.location.search.match(/.*debug=.*qgeomap.*/)

  export default {
    name: 'coords-table',

    props: {
      entry: {
        type: Object,
        required: true,
      },

      feature: {
        type: Object,
        required: true,
      },

      editable: {
        type: Boolean,
        default: false
      },
    },

    computed: {
      displayType() {
        const hasRadius = get(this.feature, 'properties.radius')
        return hasRadius ? 'Circle' : this.feature.geometry.type
      },
    },

    data () {
      return {
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
      }
    },

    mounted() {
      this.reflectInputs()
    },

    methods: {
      reflectInputs() {
        console.log('reflectInputs:', 'feature=', this.feature, 'entry=', this.entry)

        this.originalFeature = cloneDeep(this.feature)

        this.status = null
        this.error = null

        this.tableData = this.getTableData()
      },

      getTableData() {
        // console.log('getTableData: feature=', cloneDeep(this.feature))

        this.radius = null
        let list = []
        if (this.feature && this.feature.geometry) {
          // console.log(`getTableData: type=${this.feature.geometry.type}`,
          //   'coordinates=', this.feature.geometry.coordinates
          // )

          switch (this.feature.geometry.type) {
            case 'Polygon': {
              list = this.feature.geometry.coordinates[0]
              break
            }

            case 'LineString': {
              list = this.feature.geometry.coordinates
              break
            }

            case 'Point': {
              list = [this.feature.geometry.coordinates]

              this.radius = get(this.feature, 'properties.radius') || null
              break
            }
          }
        }
        return map(list, ([longitude, latitude], index) => ({
          index, latitude, longitude,
        }))
      },

      updateFeature() {
        console.log('updateFeature, this.feature=', this.feature)

        const lonlats = map(this.tableData, ({latitude, longitude}) =>
          [longitude, latitude]
        )

        const updatedFeature = cloneDeep(this.feature)

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
</script>

<style scoped>
  .error {
    font-size: smaller;
    color: darkred;
  }
</style>
