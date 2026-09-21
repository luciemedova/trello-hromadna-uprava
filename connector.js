/* global TrelloPowerUp, BULK_CONFIG */
(function () {
  'use strict';

  var base = window.location.href;
  var ICON_DARK = new URL('./icon-dark.svg', base).href;   // pro světlé pozadí
  var ICON_LIGHT = new URL('./icon-light.svg', base).href; // pro tmavé pozadí

  TrelloPowerUp.initialize({
    'board-buttons': function () {
      return [{
        icon: { dark: ICON_DARK, light: ICON_LIGHT },
        text: 'Hromadná úprava',
        condition: 'edit',
        callback: function (t) {
          return t.modal({
            url: './bulk.html',
            fullscreen: true,
            title: 'Hromadná úprava karet'
          });
        }
      }];
    }
  }, {
    appKey: BULK_CONFIG.appKey,
    appName: BULK_CONFIG.appName
  });
})();
