/**
 * Quasar App Extension index/runner script
 * (runs on each dev/build)
 *
 * Docs: https://quasar.dev/app-extensions/development-guide/index-api
 * API: https://github.com/quasarframework/quasar/blob/master/app/lib/app-extension/IndexAPI.js
 */

module.exports = function (api) {
  // (Optional!)
  // Quasar compatibility check; you may need
  // hard dependencies, as in a minimum version of the "quasar"
  // package or a minimum version of "@quasar/app" CLI
  api.compatibleWith('quasar', '^1.0.0')
  api.compatibleWith('@quasar/app', '^1.1.0 || ^2.0.0')

  // Here we extend /quasar.conf.js, so we can add
  // a boot file which registers our new UI component;
  api.extendQuasarConf(extendConf)

  api.registerDescribeApi(
    'qgeomap',
    './components/qgeomap.json'
  )
}

function extendConf (conf) {
  // register my boot file:
  conf.boot.push('~@mbari/quasar-app-extension-qgeomap/src/boot/qgeomap.js')

  // make sure boot & component files get transpiled
  conf.build.transpileDependencies.push(/@mbari[\\/]quasar-app-extension-qgeomap[\\/]src/)

  // make sure my-ext css goes through webpack to avoid ssr issues
  conf.css.push('~@mbari/quasar-app-extension-qgeomap/src/components/qgeomap.styl')

  extend(conf.extras, 'fontawesome-v5')
  // extend(conf.framework.plugins, 'Notify')
}

function extend(array, elem) {
  if (!array.includes(elem)) {
    array.push(elem)
  }
}
