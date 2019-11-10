<template>
  <div v-if="mousePos">
    <l-circle-marker
      :lat-lng="mousePos.latLon"
      color="yellow"
      :radius="mousePos.radius"
      dash-array="5 4"
    />
    <l-circle-marker
      :lat-lng="mousePos.latLon"
      :color="mousePos.color || 'red'"
      :radius="mousePos.radius * 3"
      dash-array="14 6"
    />
  </div>
</template>

<script>
  import {LCircleMarker} from 'vue2-leaflet'

  export default {
    name: 'mouse-pos-marker',

    components: {
      LCircleMarker,
    },

    props: {
      mousePos: {
        type: Object,
        default: null,
      },
    },
  }
</script>
