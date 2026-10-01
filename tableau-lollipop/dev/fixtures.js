/* Development fixtures.
 *
 * These are chosen to break things, not to flatter the chart: negatives,
 * zeroes, ties, one row, very long category names, values spanning six orders
 * of magnitude, and a set large enough to crowd the band scale.
 */
(function (global) {
  'use strict';

  function rows (pairs, colorFn, labelFn) {
    return pairs.map(function (p, i) {
      return {
        Category: p[0],
        Value: p[1],
        Segment: colorFn ? colorFn(p, i) : null,
        Note: labelFn ? labelFn(p, i) : null
      };
    });
  }

  var FIXTURES = {
    typical: {
      label: 'Typical, 8 categories',
      columns: ['Category', 'Value', 'Segment', 'Note'],
      rows: rows([
        ['Emergency', 84210], ['Intensive Care', 61980], ['Medical Surgical', 57340],
        ['Labor and Delivery', 41200], ['Operating Room', 38750], ['Oncology', 26410],
        ['Paediatrics', 19870], ['Psychiatry', 12250]
      ], function (p, i) { return i % 2 === 0 ? 'Inpatient' : 'Outpatient'; },
        function (p) { return p[0].slice(0, 3).toUpperCase(); })
    },

    negatives: {
      label: 'Positive and negative',
      columns: ['Category', 'Value', 'Segment', 'Note'],
      rows: rows([
        ['North', 4820], ['South', -2310], ['East', 1740], ['West', -3980],
        ['Central', 620], ['Offshore', -145], ['Online', 5310]
      ], function (p) { return p[1] >= 0 ? 'Gain' : 'Loss'; })
    },

    zeroesAndTies: {
      label: 'Zeroes and ties',
      columns: ['Category', 'Value', 'Segment', 'Note'],
      rows: rows([
        ['Alpha', 0], ['Bravo', 0], ['Charlie', 500], ['Delta', 500],
        ['Echo', 500], ['Foxtrot', 0], ['Golf', 1000]
      ], function () { return 'Flat'; })
    },

    single: {
      label: 'A single row',
      columns: ['Category', 'Value', 'Segment', 'Note'],
      rows: rows([['Only category there is', 42]])
    },

    longNames: {
      label: 'Very long category names',
      columns: ['Category', 'Value', 'Segment', 'Note'],
      rows: rows([
        ['Department of Cardiothoracic and Vascular Surgery, Main Campus', 9100],
        ['Ambulatory Infusion and Short Stay Observation Unit', 7420],
        ['Neonatal Intensive Care Unit, Level Four Regional Referral', 6180],
        ['Interventional Radiology and Image Guided Therapy', 3960],
        ['Short', 2100]
      ])
    },

    wideRange: {
      label: 'Six orders of magnitude',
      columns: ['Category', 'Value', 'Segment', 'Note'],
      rows: rows([
        ['Global', 4830000], ['Continental', 512000], ['National', 68400],
        ['Regional', 9120], ['Metro', 840], ['Local', 96], ['Site', 7]
      ])
    },

    decimals: {
      label: 'Small decimals and percents',
      columns: ['Category', 'Value', 'Segment', 'Note'],
      rows: rows([
        ['Sensitivity', 0.942], ['Specificity', 0.871], ['Precision', 0.796],
        ['Recall', 0.913], ['F1', 0.852], ['Accuracy', 0.888]
      ])
    },

    crowded: {
      label: 'Crowded, 40 categories',
      columns: ['Category', 'Value', 'Segment', 'Note'],
      rows: (function () {
        var out = [];
        for (var i = 1; i <= 40; i++) {
          out.push(['Item ' + String(i).padStart(2, '0'), Math.round(1000 * Math.exp(-i / 11) * (0.7 + (i % 7) / 10))]);
        }
        return rows(out, function (p, i) { return 'Group ' + (i % 5 + 1); });
      })()
    },

    empty: {
      label: 'No rows at all',
      columns: ['Category', 'Value', 'Segment', 'Note'],
      rows: []
    }
  };

  global.LP_FIXTURES = FIXTURES;
})(typeof window !== 'undefined' ? window : globalThis);
