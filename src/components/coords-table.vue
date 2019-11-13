<template>
  <q-page>
    <form class="q-mt-sm">
      <div class="row q-gutter-md">

        <span>ID: {{ entry.entry_id }}</span>

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

        <pre
          v-if="debug"
          style="font-size: smaller" class="bg-blue-1"
        >feature={{feature}}</pre>
      </div>
    </form>
  </q-page>
</template>

<script>
  import cloneDeep from 'lodash/cloneDeep'
  import isEqual from 'lodash/isEqual'
  import map from 'lodash/map'

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

    data () {
      return {
        debug,

        originalFeature: null,

        displayType: '?',

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
      }
    },

    mounted() {
      this.reflectInputs()
    },

    methods: {
      reflectInputs() {
        console.log('reflectInputs:', 'feature=', this.feature, 'entry=', this.entry)

        this.originalFeature = cloneDeep(this.feature)

        this.displayType = this.feature.geometry.type

        this.status = null
        this.error = null

        this.tableData = this.getTableData()
      },

      noChanges() {
        return isEqual(this.feature, this.originalFeature)
      },

      reflectChanges() {
        const newFeature = cloneDeep(this.feature)
        // TODO
        // const token_id = tid(this.entry.token)
        // this.$store.commit('model/setTokenGeometry', {token_id, geometry: newFeature})
      },

      getTableData() {
        // console.log('getTableData: feature=', cloneDeep(this.feature))

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
              break
            }
          }
        }
        return map(list, ([longitude, latitude], index) => ({
          index, latitude, longitude,
        }))
      },

      updateFeature(tableData) {
        // console.log('updateFeature')
        const lonlats = map(tableData, ({latitude, longitude}) =>
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
    },

    watch: {
      feature() {
        this.reflectInputs()
      },

      tableData: {
        handler(tableData) {
          this.updateFeature(tableData)
        },
        deep: true,
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
