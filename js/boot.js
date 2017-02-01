/** This is our main module for the particle web client application */
app = angular.module("ParticleWebClient", ['ngRoute', 'ngStorage', 'ui.bootstrap-slider', 'minicolors']);

enabledPlugins = [];
enabledApps = [];

function registerApp(app) {
    enabledApps.push(app);
}