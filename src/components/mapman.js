export {
  createMapMan,
}

import L from 'leaflet'
import * as esri from 'esri-leaflet/dist/esri-leaflet'
import 'leaflet.gridlayer.googlemutant/Leaflet.GoogleMutant'
import 'leaflet-mouse-position/src/L.Control.MousePosition'
import 'leaflet-draw'
import 'leaflet-draw-drag'
import each from 'lodash/each'
import get from 'lodash/get'

const debug = window.location.search.match(/.*debug=.*qgeomap.*/)

try {
  // adjust these messages to avoid the 'Save' term:
  L.drawLocal.edit.toolbar.actions.save.text = 'Apply'
  L.drawLocal.edit.toolbar.actions.save.title = 'Apply the changes'
}
catch(error) {
  console.warn(error)
}

function createMapMan(map, drawFeatureGroup, initialBaseLayerName) {
  if (debug) console.debug('createMapMan: drawFeatureGroup=', drawFeatureGroup,
    'initialBaseLayerName=', initialBaseLayerName)

  L.DomUtil.addClass(map._container, 'my-default-cursor')
  mousePosition.addToMap(map)
  initBaseLayers(map, initialBaseLayerName)

  let entryEdited = null
  let drawControl = null

  map.on(L.Draw.Event.CREATED, e => {
    console.warn('L.Draw.Event.CREATED', e)
    // just add the layer as created.
    drawFeatureGroup.addLayer(e.layer)
  })

  map.on(L.Draw.Event.DRAWSTART, e => {
    console.warn('L.Draw.Event.DRAWSTART', e)
  })

  map.on(L.Draw.Event.DRAWSTOP, e => {
    console.warn('L.Draw.Event.DRAWSTOP', e)
  })

  map.on(L.Draw.Event.DRAWVERTEX, e => {
    console.warn('L.Draw.Event.DRAWVERTEX', e)
  })

  map.on(L.Draw.Event.EDITSTART, e => {
    console.warn('L.Draw.Event.EDITSTART', e)
  })

  map.on(L.Draw.Event.EDITMOVE, e => {
    console.warn('L.Draw.Event.EDITMOVE', e)
  })

  map.on(L.Draw.Event.EDITRESIZE, e => {
    console.warn('L.Draw.Event.EDITRESIZE', e)
  })

  map.on(L.Draw.Event.EDITVERTEX, e => {
    console.warn('L.Draw.Event.EDITVERTEX', e)
  })

  map.on(L.Draw.Event.EDITSTOP, e => {
    console.warn('L.Draw.Event.EDITSTOP', e)
  })

  return {
    isEditing,
    startEditing,
    endEditing,
    zoomToEdited,
  }

  function isEditing() {
    return !!entryEdited
  }

  function startEditing(entry) {
    const prevEntry = entryEdited

    endEditing()

    if (entry) {
      entryEdited = entry
      addLayersToDraw(entryEdited)
      drawControl = createDrawControl(drawFeatureGroup, entry)
      map.addControl(drawControl)
    }

    return prevEntry
  }

  function endEditing() {
    if (drawControl) {
      map.removeControl(drawControl)
      drawControl = null
    }
    let ret = null
    if (entryEdited) {
      const geometry = drawGroupToGeoJSON()
      ret = {entryEdited, geometry}
      entryEdited = null
    }
    return ret
  }

  function zoomToEdited() {
    const layers = drawFeatureGroup.getLayers()
    if (layers && layers.length) {
      const bounds = drawFeatureGroup.getBounds()
      // console.warn('zoomToEdited: bounds=', bounds)
      map.fitBounds(bounds, {maxZoom: 11})
      return true
    }
  }

  function drawGroupToGeoJSON() {
    const layers = []
    drawFeatureGroup.eachLayer(layer => {
      console.warn('drawGroupToGeoJSON', 'layer=', layer)
      if (layer.getRadius) {
        const radius = layer.getRadius()
        const coordinates = L.GeoJSON.latLngToCoords(layer.getLatLng())
        layers.push(L.geoJSON({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates,
          },
          properties: {
            radius,
          }
        }))
      }
      else {
        layers.push(layer)
      }
    })
    drawFeatureGroup.clearLayers()
    return new L.FeatureGroup(layers).toGeoJSON()
  }

  function addLayersToDraw(entry) {
    console.warn('addLayersToDraw: entry=', entry)

    const entryLayer = geometryToLayer(entry, entry.geometry)
    addNonGroupLayers(entryLayer, drawFeatureGroup)
  }

  // https://gis.stackexchange.com/a/203773
  function addNonGroupLayers(sourceLayer) {
    // console.warn('addNonGroupLayers: sourceLayer=', sourceLayer)
    if (sourceLayer instanceof L.LayerGroup) {
      sourceLayer.eachLayer(function (layer) {
        addNonGroupLayers(layer)
      })
    }
    else {
      drawFeatureGroup.addLayer(sourceLayer)
      sourceLayer.addTo(map)
    }
  }
}

function getEditModeForEntry(entry) {
  if (entry.is_new) {
    return {
      draw: entry.is_new.geomType
    }
  }
  else if (entry.geometry) {
    return {
      edit: getEditMode(entry.geometry)
    }
  }

  function getEditMode(geometry) {
    switch(geometry.type) {
      case 'Feature':
        const hasRadius = get(geometry, 'properties.radius')
        const geomType = get(geometry, 'geometry.type')
        return hasRadius && geomType === 'Point' ? 'Circle' : getEditMode(geometry.geometry)

      default:
        return geometry.type
    }
  }
}

function createDrawControl(featureGroup, entry) {
  console.log('createDrawControl: entry=', entry)

  const editMode = getEditModeForEntry(entry)
  console.log('createDrawControl: editMode=', editMode)

  // TODO use editMode to set the following as appropriate

  let edit = null
  let draw = null

  if (editMode.edit) {
    edit = {
      featureGroup,
      edit: {
        selectedPathOptions: {
          maintainColor: true,
          fillOpacity: 0.3,
        },
        moveMarkers: true, // centroids, default: false
        shapeOptions: {
          color: '#ff0000',
        },
      },
      poly: {
        allowIntersection: false,
        showArea: true,
      },
      remove: true,
    }
  }
  else if (editMode.draw) {
    // TODO determine specific draw options:

    const repeatMode = true

    draw = {
      circle: editMode.draw === 'Circle' ? {
        shapeOptions: {
          color: entry.color || '#f357a1',
          weight: 4,
        },
        showArea: true,
      } : null,

      circlemarker: null/*{
        shapeOptions: {
          weight: 4
        },
        repeatMode,
      }*/,

      marker: null/*{
        repeatMode,
      }*/,

      rectangle: editMode.draw === 'Rectangle' ?  {
        shapeOptions: {
          color: entry.color || '#ff0000',
          weight: 4
        },
        showArea: true,
      } : null,

      polyline: editMode.draw === 'LineString' ? {
        shapeOptions: {
          color: entry.color || '#f357a1',
          weight: 4
        },
      } : null,

      polygon: editMode.draw === 'Polygon' ? {
        allowIntersection: false, // Restricts shapes to simple polygons
        drawError: {
          color: '#e1e100', // Color the shape will turn when intersects
        },
        shapeOptions: {
          color: entry.color || '#bada55'
        },
        showArea: true,
      } : null,
    }
  }

  const options = {
    position: 'topleft',
    edit,
    draw,
  }

  return new L.Control.Draw(options)
}

function initBaseLayers(map, initialBaseLayerName) {
  const esriOceansLayer = esri.basemapLayer('Oceans')
  const esriOceansLabelsLayer = esri.basemapLayer('OceansLabels')
  const esriOceansWithLabelsLayer = L.featureGroup([esriOceansLayer, esriOceansLabelsLayer])
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
  const gHybridLayer = L.gridLayer.googleMutant({type: 'hybrid'})
  const gSatelliteLayer = L.gridLayer.googleMutant({type: 'satellite'})

  // TODO leaflet or esri bug? radio button 'ESRI Oceans' seems to be always pre-selected
  // if 'ESRI Oceans' is added (B1), and 'ESRI Oceans/Labels' is  added to the map (B2).
  // Also, a 2nd click on 'ESRI Oceans/Labels' brings the one with only the labels!
  const baseLayers = {
    'ESRI Oceans/Labels': esriOceansWithLabelsLayer,
    // 'ESRI Oceans': esriOceansLayer, /*(B1)*/
    'OpenStreetMap': osmLayer,
    'Google hybrid': gHybridLayer,
    'Google satellite': gSatelliteLayer,
  }
  const controlLayers = L.control.layers(baseLayers).addTo(map)

  let baseLayerName = initialBaseLayerName || 'Google satellite'   // 'ESRI Oceans/Labels'  /*(B2)*/
  baseLayers[baseLayerName].addTo(map)
}

// helper related with L.control.mousePosition
const mousePosition = (() => {
  let prefix = ''  // with depth if available

  const separator = ', '
  const latFormatter = v => prefix + v.toFixed(5)
  const lngFormatter = v => v.toFixed(5)
  const mpos = L.control.mousePosition({
    position: 'topright',
    emptyString: '&nbsp;',
    separator,
    latFormatter,
    lngFormatter,
  })

  return {
    addToMap: map => {
      mpos.addTo(map)
    },
  }
})()

function geometryToLayer(entry, geometry = entry.geometry) {
  switch (geometry.type) {
    case 'FeatureCollection': {
      // L.GeoJSON.geometryToLayer does not support FeatureCollection
      // but supports Feature:
      const layers = []
      each(geometry.features, feature => {
        const layer = geometryToLayer(entry, feature)
        if (layer) {
          layers.push(layer);
        }
      })
      return new L.FeatureGroup(layers)
    }

    default:
      return L.GeoJSON.geometryToLayer(geometry, entry.options)
  }
}
