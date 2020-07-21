<template>
  <div>
    <q-layout
      view="lhh LpR lff"
      container
      :style="sizeInfo.containerStyle"
      class="shadow-2 rounded-borders"
    >
      <q-header reveal class="bg-primary glossy">
        <q-toolbar>
          <q-toolbar-title>{{ label }}</q-toolbar-title>
          <q-btn flat dense icon="menu" @click="drawerRight = !drawerRight" />
        </q-toolbar>
      </q-header>

      <div style="height:50px">filler</div>

      <div :style="sizeInfo.qgeomapStyle">
        <div class="gjMap fit">
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
              v-on:startEditing="_startEditing"
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
      </div>

      <q-drawer
        side="right"
        :value="drawerRight && selectedEntry && !!selectedFeature"
        bordered
        :width="200"
        :breakpoint="500"
        content-class="bg-primary"
      >
        <q-scroll-area class="fit">
          <div
            v-if="drawerRight && selectedEntry && !!selectedFeature"
          >
            <coords-table
              :feature="selectedFeature"
              :editable="editable && !isEditing()"
              :debug-feature="debugFeature"
              v-on:mousePos="_mousePosFromCoordsTable"
              v-on:centerMapAt="_centerMapAt"
              v-on:updatedFeature="_updatedFeature"
            />
          </div>
        </q-scroll-area>
      </q-drawer>
    </q-layout>

  </div>
</template>

<script>
  import MapButtons from '@mbari/quasar-app-extension-qgeomap/src/components/map-buttons'
  import MousePosMarker from '@mbari/quasar-app-extension-qgeomap/src/components/mouse-pos-marker'
  import CoordsTable from '@mbari/quasar-app-extension-qgeomap/src/components/coords-table'

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

  const debug = window.location.search.match(/.*debug=.*qgeomap.*/)

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
      initialBaseLayerName: {
        type: String,
        required: false
      },

      googleApiKey: {
        type: String,
        required: false
      },

      editable: {
        type: Boolean,
        default: false
      },

      label: {
        type: String,
        default: ''
      },

      includeTable: {
        type: Boolean,
        default: false
      },

      tablePosition: {
        type: String,
        default: undefined
      },

      mousePos: {
        type: Object,
        default: null,
      },

      debugFeature: {
        type: String,  // position
        default: null
      },
    },

    data: () => ({
      center: [36.83, -121.9],
      zoom: 10,

      drawerRight: true,

      selectedEntry: null,
      selectedFeature: null,

      entries: [],

      mousePosFromCoordsTable: null,
      coordsTableEditable: false,
    }),

    computed: {
      sizeInfo() {
        return this.editable ? {
          containerStyle: 'height:600px;width:700px',
          qgeomapStyle: 'height:550px;width:700px',
        } : {
          containerStyle: 'height:600px;width:700px',
          qgeomapStyle: 'height:550px;width:700px',
        }
      },
    },

    mounted() {
      // this.setFeatureData(this.value)
      this.$nextTick(() => {
        const map = this.mapObject = this.$refs.gjMap.mapObject
        const drawFeatureGroup = this.$refs.drawFeatureGroup.mapObject

        if (debug) console.debug(`qgeomap mounted:`, 'map=', map)

        this.mapMan = createMapMan(map, drawFeatureGroup,
            this.initialBaseLayerName, this.googleApiKey)

        map.on('click', e => {
          this.selectedEntry = null
          this.selectedFeature = null
        })
      })
    },

    methods: {
      addEntry(entry) {
        if (debug) console.log('addEntry:', cloneDeep(entry))

        const prevEntry = find(this.entries, {entry_id: entry.entry_id})
        if (prevEntry) {
          return this._warning(`Duplicate entry by id: '${entry.entry_id}'`)
        }

        // TODO should entry.geometry be required?
        if (!entry.geometry) {
          entry.geometry = {
            type: "FeatureCollection",
            features: []
          }
        }

        entry.layers = []

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
            // TODO having "invalid img url" issue with marker...
            // return new L.Marker(latlng)
            // ... let's use a small circle for the moment:
            return new L.Circle(latlng, 200)
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
            L.DomEvent.stop(e)
            this.selectedFeature = e.target.feature
            if (debug) console.log("click: selectedFeature=", this.selectedFeature)
            this._entrySelection(entry)
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
        if (debug) console.log("removeEntry: entry_id=", entry_id)
        const index = findIndex(this.entries, {entry_id})
        if (index >= 0) {
          const [entry] = this.entries.splice(index, 1)
          if (debug) console.log("removeEntry: entry removed=", entry)
        }
      },

      getEntries() {
        return this.entries
      },

      selectEntry(entry_id) {
        // TODO check any ongoing editing

        const entry = find(this.entries, {entry_id})
        if (debug) console.log("selectEntry: entry_id=", entry_id, 'entry=', entry)
        if (entry) {
          this.selectedFeature = entry.geometry
          if (debug) console.log("selectEntry: selectedFeature=", this.selectedFeature)
          this._entrySelection(entry)
        }
        else return this._warning(`No entry to select by id: '${entry_id}'`)
      },

      editEntry(entry_id) {
        if (!this.editable) {
          return this._warning('not editable')
        }

        if (debug) console.log("editEntry: entry_id=", entry_id)
        // TODO check any ongoing editing

        const entry = find(this.entries, {entry_id})
        if (entry) {
          this._entrySelection(entry)
          this._startEditing()
        }
        else return this._warning(`No entry to edit by id: '${entry_id}'`)
      },

      editNew(geomType, entry_id) {
        if (!this.editable) {
          return this._warning('not editable to add new geometry')
        }

        if (debug) console.log("editNew: geomType=", geomType, 'entry_id=', entry_id)

        const entry = {
          entry_id,
          color: 'yellow',
          tooltip: `new of type ${geomType}`,
          is_new: {
            geomType
          },
        }

        this.addEntry(entry)
        this.editEntry(entry.entry_id)
      },

      _mousePosFromCoordsTable(p) {
        // console.log("_mousePosFromCoordsTable: p=", p)
        this.mousePosFromCoordsTable = p ? {latLon: p, radius: 5} : null
      },

      _entrySelection(entry) {
        if (debug) console.log("_entrySelection: entry=", entry, 'selectedEntry=', this.selectedEntry)

        if (this.isEditing()) {
          // TODO proper handling if editing
          // For now, ignoring.
          return
        }

        // only reflect selection on map if entry_id given
        if (entry.entry_id) {
          this.selectedEntry = entry
        }
        else {
          this.selectedEntry = null
        }
        this._bringSelectedEntryToFront()
      },

      _bringSelectedEntryToFront() {
        if (this.selectedEntry) {
          this._findAndExtractEntry(this.selectedEntry.entry_id)
          this.entries.push(this.selectedEntry)
        }
      },

      isEditing() {
        return this.mapMan && this.mapMan.isEditing()
      },

      _startEditing() {
        if (debug) console.log('_startEditing:', 'selectedEntry=', this.selectedEntry)

        if (this.selectedEntry) {
          this._findAndExtractEntry(this.selectedEntry.entry_id)
          if (debug) console.log('_startEditing:', 'selectedEntry=', this.selectedEntry)
          this._setEntriesInteractive(false)
          this.mapMan.startEditing(this.selectedEntry)
        }

        // notify client, in particular in case of not having a selectedEntry
        this.$emit('startEditing', this.selectedEntry)
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
        if (debug) console.log("_applyEdits: prevEntry=", prevEntry)
        if (prevEntry) {
          let {entryEdited, geometry} = prevEntry

          if (debug) console.log('updating geometry to', cloneDeep(geometry))

          if (geometry.type === 'FeatureCollection') {
            if (geometry.features.length === 1) {
              geometry = geometry.features[0]
            }
          }

          delete entryEdited.is_new

          // reflect updated geometry:
          entryEdited.geometry = geometry
          this.entries.push(entryEdited)
          this.selectedEntry = entryEdited

          this.selectedFeature = geometry

          this.$emit('editsApplied', entryEdited)
        }
        this._setEntriesInteractive(true)
      },

      _cancelEdits() {
        const prevEntry = this.mapMan.endEditing()
        if (debug) console.log("_cancelEdits: prevEntry=", prevEntry)
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
        if (bounds && bounds.isValid()) {
          this.mapObject.fitBounds(bounds, {maxZoom: 11})
        }
        else return this._warning('No bounds to zoom to')
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
          message = 'No selected geometry'
        }

        if (message) {
          return this._warning(message)
        }
      },

      _doZoom(out) {
        const map = this.$refs.gjMap.mapObject
        out ? map.zoomOut() : map.zoomIn()
      },

      _centerMapAt(latLon) {
        if (debug) console.log('_centerMapAt', latLon)
        this.center = latLon
      },

      _updatedFeature(feature) {
        // console.log('_updatedFeature', feature, 'selectedEntry=', this.selectedEntry)
        this.selectedFeature = feature
        this.selectedEntry.geometry = feature
        this.$emit('editsApplied', this.selectedEntry)
      },

      _warning(message) {
        this.$emit('warning', message)
        return message
      },
    },
  }

</script>

<style src="leaflet/dist/leaflet.css" />
<style src="leaflet-draw/dist/leaflet.draw.css" />

<style>
  .gjMap {
    border: 1px solid black;
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
