<template>
  <div
    :class="`relative-position map-buttons column ${isEditing ? 'margin-left2' : 'margin-left1'}`"
    @dblclick.stop.prevent="() => {}"
  >
    <div class="row">
      <div>
        <q-btn
          v-if="editable"
          icon="edit" dense glossy size="sm"
          :color="selectionForEditing ? 'yellow-7' : 'yellow-2'"
          class="shadow-8 q-mr-lg text-black"
          :disable="isEditing"
          @click.stop.prevent="$emit('startEditing')"
        />
        <!--separate tooltip to avoid issue of having it open forever sometimes -->
        <q-tooltip anchor="center left" self="center right">
          Edit selected geometries
        </q-tooltip>
      </div>

      <div class="row">
        <q-btn
          v-if="!$q.platform.is.mobile"
          dense glossy color="indigo-11" size="sm"
          icon="fas fa-search-plus"
          class="shadow-8"
          @click.stop.prevent="$emit('doZoom', false)"
        >
          <q-tooltip anchor="center left" self="center right">
            Zoom in
          </q-tooltip>
        </q-btn>

        <q-btn
          v-if="!$q.platform.is.mobile"
          dense glossy color="indigo-11" size="sm"
          icon="fas fa-search-minus"
          class="shadow-8 q-ml-xs"
          @click.stop.prevent="$emit('doZoom', true)"
        >
          <q-tooltip anchor="center left" self="center right">
            Zoom out
          </q-tooltip>
        </q-btn>

        <q-btn
          dense glossy color="indigo-11" size="sm"
          icon="center_focus_weak"
          class="shadow-8 q-ml-sm"
          @click.stop.prevent="$emit('zoomToAll')"
        >
          <q-tooltip anchor="center left" self="center right">
            Zoom to all geometries, if any
          </q-tooltip>
        </q-btn>
      </div>

    </div>

    <div
      class="column q-mt-xs" style="width:20px"
    >
      <div>
        <q-btn
          dense glossy size="sm"
          :color="selectionForEditing ? 'yellow-7' : 'yellow-2'"
          icon="center_focus_weak"
          class="shadow-8 q-mb-xs text-black"
          @click.stop.prevent="$emit('zoomToAllSelected')"
        />
        <q-tooltip anchor="center left" self="center right">
          Zoom to all selected geometries
        </q-tooltip>
      </div>

      <q-btn
        v-if="editable && isEditing"
        dense glossy color="yellow" size="sm"
        label="OK" no-caps
        class="shadow-8 q-mb-xs text-black"
        @click.stop.prevent="$emit('applyEdits')"
      >
        <q-tooltip anchor="center left" self="center right">
          Apply any geometry edits
        </q-tooltip>
      </q-btn>
      <q-btn
        v-if="editable && isEditing"
        dense glossy color="yellow" size="sm"
        icon="cancel"
        class="shadow-8 text-black"
        @click.stop.prevent="$emit('cancelEdits')"
      >
        <q-tooltip anchor="center left" self="center right">
          Cancel any geometry edits
        </q-tooltip>
      </q-btn>
    </div>
  </div>
</template>

<script>
  const debug = window.location.search.match(/.*debug=.*qgeomap.*/)

  export default {
    name: 'map-buttons',

    props: {
      editable: {
        type: Boolean,
        default: false
      },

      isEditing: {
        type: Boolean,
        default: false
      },

      selectionForEditing: {
        type: Boolean,
        default: false
      },
    },
  }
</script>

<style scoped>
  .map-buttons {
    width: 140px;  /* small so it doesn't prevent/affect mouse interaction on the rest of the map */
    z-index: 999 !important;
    margin-top: 12px;
  }
  .margin-left1 {
    margin-left: 12px;
  }
  .margin-left2 {
    margin-left: 50px;
  }
</style>
