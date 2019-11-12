<template>
  <table style="height:100%; width:100%">
    <tbody>
    <tr style="height:100%; width:100%">
      <td>
        <div
          class="gjMap fit"
          :style="`width:${mapWidth};height:${mapHeight}`"
        >
          <l-map
            ref="gjMap"
            :zoom="zoom"
            :center="center"
            :options="{zoomControl:false, attributionControl: false}"
          >
            <map-buttons
              :editable="editable"
              :selection-for-editing="!!selectedEntry"
              :is-editing="isEditing()"
              v-on:doZoom="_doZoom"
              v-on:zoomToAll="zoomToAll"
              v-on:zoomToAllSelected="zoomToAllSelected"
              v-on:startEditing="startEditing"
              v-on:applyEdits="_applyEdits"
              v-on:cancelEdits="_cancelEdits"
            />

            <l-feature-group ref="staticFeatureGroup">
              <l-geo-json
                v-for="(entry, index) in entries"
                :key="`entry_${index}`"
                :ref="`entry_${index}`"
                :geojson="entry.geometry"
                :options="entry.options"
              >
              </l-geo-json>
            </l-feature-group>

            <l-feature-group ref="drawFeatureGroup">
            </l-feature-group>

            <slot name="map-body">
              <mouse-pos-marker
                :mouse-pos="mousePosFromCoordsTable || mousePos"
              />
            </slot>

          </l-map>

        </div>
      </td>
      <td
        v-if="includeTable && selectedEntry && selectedFeature"
        :style="`width:${tableWidth}`"
      >
        <coords-table
          class="q-ma-xs"
          :entry="selectedEntry"
          :feature="selectedFeature"
          v-on:mousePos="onMousePosFromCoordsTable"
          v-on:centerMapAt="_centerMapAt"
        />
      </td>
    </tr>
    </tbody>
  </table>
</template>

<script>
  import MapButtons from '@mbari/quasar-app-extension-qgeomap/src/components/map-buttons'
  import MousePosMarker from '@mbari/quasar-app-extension-qgeomap/src/components/mouse-pos-marker'
  import CoordsTable from '@mbari/quasar-app-extension-qgeomap/src/components/coords-table'

  // import Vue2LeafletGoogleMutant from 'vue2-leaflet-googlemutant'

  import {
    LMap,
    LFeatureGroup,
    LLayerGroup,
    LGeoJson,
  } from 'vue2-leaflet'

  import { createMapMan } from './mapman.js'

  import cloneDeep from 'lodash/cloneDeep'
  import get from 'lodash/get'
  import findIndex from 'lodash/findIndex'
  import find from 'lodash/find'
  import each from 'lodash/each'

  const debug = true//window.location.search.match(/.*debug=.*qgeomap.*/)

  export default {
    name: 'qgeomap',

    mapObject: null,

    mapMan: null,

    components: {
      LMap,
      LFeatureGroup,
      LLayerGroup,
      LGeoJson,

      MapButtons,
      MousePosMarker,
      CoordsTable,
    },

    props: {
      editable: {
        type: Boolean,
        default: false
      },

      includeTable: {
        type: Boolean,
        default: false
      },

      mousePos: {
        type: Object,
        default: null,
      },
    },

    computed: {
      tableWidth() {
        return `70px`
      },

      mapWidth() {
        if (this.includeTable && this.selectedEntry && this.selectedFeature) {
          return `calc(100% - ${this.tableWidth})`
        }
        else {
          return `100%`
        }
      },

      mapHeight() {
        return `100%`
      },
    },

    data: () => ({
      center: [36.83, -121.9],
      zoom: 10,

      selectedEntry: null,
      selectedFeature: null,

      entries: [],

      mousePosFromCoordsTable: null,
    }),

    mounted() {
      // this.setFeatureData(this.value)
      this.$nextTick(() => {
        const map = this.mapObject = this.$refs.gjMap.mapObject
        const drawFeatureGroup = this.$refs.drawFeatureGroup.mapObject

        if (debug) console.debug(`qgeomap mounted:`, 'map=', map)

        this.mapMan = createMapMan(map, drawFeatureGroup)
      })
    },

    methods: {
      addEntry(entry) {
        if (debug) console.log('addEntry:', cloneDeep(entry))

        const prevEntry = find(this.entries, {entry_id: entry.entry_id})
        if (prevEntry) {
          this.$emit('warning', `Duplicate entry by id: '${entry.entry_id}'`)
          return
        }

        if (!entry.geometry) {
          entry.geometry = {
            type: "FeatureCollection",
            features: []
          }
        }

        entry.layers = []

        const vm = this

        entry.weight = entry.weight || 3

        entry.options = entry.options || {}

        //entry.options.showMeasurements = true // not working well yet

        entry.options.style = feature => ({
          color: entry.color,
          weight: entry.weight,
          fillOpacity: 0.1,
        })

        entry.options.pointToLayer = (feature, latlng) => {
          if (feature.properties && feature.properties.radius) {
            return new L.Circle(latlng, feature.properties.radius)
          }
          else {
            return new L.Marker(latlng)
          }
        }

        entry.options.onEachFeature = (feature, layer) => {
          // console.log('onEachFeature:', 'feature=', feature, 'layer=', layer)
          if (entry.tooltip) {
            layer.bindTooltip(entry.tooltip, {sticky: true})
          }

          layer.on('mouseover', e => {
            if (e.target.setStyle) {
              e.target.setStyle({
                weight: entry.weight + 3
              })
            }
          });

          layer.on('mouseout', e => {
            // e.target.resetStyle()
            if (e.target.setStyle) {
              e.target.setStyle({
                weight: entry.weight,
              })
            }
          })

          layer.on('click', e => {
            this.selectedFeature = e.target.feature
            this.entrySelection(entry)
          })

          layer.on('dblclick', e => {
            // just ignore
            L.DomEvent.stop(e)
          })

          entry.layers.push(layer)
        }

        this.entries.push(entry)
      },

      removeEntry(entry_id) {
        console.log("removeEntry: entry_id=", entry_id)
        const index = findIndex(this.entries, {entry_id})
        if (index >= 0) {
          const [entry] = this.entries.splice(index, 1)
          console.log("removeEntry: entry removed=", entry)
        }
      },

      editEntry(entry_id) {
        if (!this.editable) {
          this.$emit('warning', 'not editable')
          return
        }

        console.log("editEntry: entry_id=", entry_id)
        // TODO check any ongoing editing

        const entry = find(this.entries, {entry_id})
        if (entry) {
          this.entrySelection(entry)
          this.startEditing()
        }
        else this.$emit('warning', `No entry by id: '${entry_id}'`)
      },

      onMousePosFromCoordsTable(p) {
        // console.log("onMousePosFromCoordsTable: p=", p)
        this.mousePosFromCoordsTable = p ? {latLon: p, radius: 5} : null
      },

      entrySelection(entry) {
        console.log("entrySelection: entry=", entry, 'selectedEntry=', this.selectedEntry)

        if (this.isEditing()) {
          // TODO proper handling if editing
          // For now, ignoring.
          return
        }

        // if (this.selectedEntry && this.selectedEntry.entry_id === entry.entry_id) {
        //   this.selectedEntry = null
        //   this.selectedFeature = null
        //   return
        // }

        // only reflect selection on map if entry_id given
        if (entry.entry_id) {
          this.selectedEntry = entry
        }
        else {
          this.selectedEntry = null
        }
        this.bringSelectedEntryToFront()
      },

      bringSelectedEntryToFront() {
        if (this.selectedEntry) {
          this._findAndExtractEntry(this.selectedEntry.entry_id)
          this.entries.push(this.selectedEntry)
        }
      },

      isEditing() {
        return this.mapMan && this.mapMan.isEditing()
      },

      startEditing() {
        if (this.selectedEntry) {
          this._findAndExtractEntry(this.selectedEntry.entry_id)
          console.log('startEditing:', 'selectedEntry=', this.selectedEntry)
          this._setEntriesInteractive(false)
          this.mapMan.startEditing(this.selectedEntry)
        }
        else this.$emit('warning', 'Select the entry whose geometries you want to edit')
      },

      _setEntriesInteractive(interactive) {
        const saveEntries = this.entries;
        this.entries = []
        this.$nextTick(() => {
          each(saveEntries, entry => {
            entry.options = entry.options || {}
            entry.options.interactive = interactive
            this.entries.push(entry)
          })
        })
      },

      _applyEdits() {
        const prevEntry = this.mapMan.endEditing()
        console.log("_applyEdits: prevEntry=", prevEntry)
        if (prevEntry) {
          const {entryEdited, geometry} = prevEntry

          console.log('updating geometry to', cloneDeep(geometry))

          // reflect updated geometryL
          entryEdited.geometry = geometry
          this.entries.push(entryEdited)
          this.selectedEntry = entryEdited
        }
        this._setEntriesInteractive(true)
      },

      _cancelEdits() {
        const prevEntry = this.mapMan.endEditing()
        console.log("_cancelEdits: prevEntry=", prevEntry)
        if (prevEntry) {
          const {entryEdited} = prevEntry
          this.entries.push(entryEdited)
          // this.$timelineWidget.enableSelectionAndEditing()
        }
        this._setEntriesInteractive(true)
      },

      _findEntryIndex(entry_id) {
        return findIndex(this.entries, entry =>
            entry_id === entry.entry_id
        )
      },

      _findAndExtractEntry(entry_id) {
        const index = this._findEntryIndex(entry_id)
        if (index >= 0) {
          const [entry] = this.entries.splice(index, 1)
          return entry
        }
      },

      zoomToAll() {
        const staticFeatureGroup = this.$refs.staticFeatureGroup.mapObject
        const drawFeatureGroup = this.$refs.drawFeatureGroup.mapObject
        const allGroup = L.featureGroup([staticFeatureGroup, drawFeatureGroup])
        const bounds = allGroup.getBounds()
        this.mapObject.fitBounds(bounds, {maxZoom: 11})
      },

      zoomToEdited() {
        return this.mapMan && this.mapMan.zoomToEdited()
      },

      zoomToAllSelected() {
        let message = null

        if (this.isEditing()) {
          if (!this.zoomToEdited()) {
            message = 'No geometries associated'
          }
        }
        else if (this.selectedEntry) {
          // TODO index should just be this.entries.length - 1.
          const index = this._findEntryIndex(this.selectedEntry.entry_id)
          if (index >= 0) {
            const ref = this.$refs[`entry_${index}`]
            // console.log('zoomToAllSelected: ref=', ref)
            const llObj = ref.length && ref[0]
            if (llObj) {
              if (llObj.getBounds) {
                const bounds = llObj.getBounds()
                if (bounds.isValid()) {
                  this.mapObject.fitBounds(bounds, {maxZoom: 11})
                }
                else message = 'No geometries/bounds to zoom to'
              }
            }
          }
          else console.warn('Unexpected: no index found for selected entry')
        }
        else {
          message = 'No selected entry'
        }

        if (message) {
          this.$emit('warning', message)
        }
      },

      _doZoom(out) {
        const map = this.$refs.gjMap.mapObject
        out ? map.zoomOut() : map.zoomIn()
      },

      _centerMapAt(latLon) {
        console.log('_centerMapAt', latLon)
        this.center = latLon
      },
    },
  }

</script>

<style src="leaflet/dist/leaflet.css" />
<style src="leaflet-draw/dist/leaflet.draw.css" />

<style>
  .gjMap {
    border: 1px solid red;
    /*overflow: auto;*/
  }

  .leaflet-container.my-default-cursor {
    cursor: default;
  }

  .leaflet-control-mouseposition {
    font-family: monospace, serif !important;
    font-size: smaller !important;
    background-color: rgba(255, 255, 255, 0.75) !important;
    padding: 0 4px 0 4px !important;
    border: 1px solid lightgray;
    border-radius: 4px;
    box-shadow: 0 5px 5px -3px rgba(0,0,0,0.2), 0 8px 10px 1px rgba(0,0,0,0.14), 0 3px 14px 2px rgba(0,0,0,0.12);
  }

</style>
