// Dated satellite image measurements. See GOLD-COAST-PARKING-QA-PLAN.md.
export const GOLD_COAST_GA_IMAGERY = {
  "captureDate": "2025-12-01",
  "provider": "Esri World Imagery / Vantor Vivid Advanced",
  "resolutionM": 0.34,
  "positionalAccuracyM": 8.47,
  "sourceUrl": "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer",
  "helipads": [
    {
      "id": "H3",
      "referencePixel": [
        1158,
        1651
      ],
      "maxRotorDiameterM": 11,
      "markingDiameterM": 7.5,
      "latitude": -28.16149951332116,
      "longitude": 153.50889580974197
    },
    {
      "id": "H2",
      "referencePixel": [
        1221,
        1714
      ],
      "maxRotorDiameterM": 11,
      "markingDiameterM": 7.5,
      "latitude": -28.1616635737036,
      "longitude": 153.50908189939676
    },
    {
      "id": "H1",
      "referencePixel": [
        1295,
        1789
      ],
      "maxRotorDiameterM": 14.1,
      "markingDiameterM": 10,
      "latitude": -28.1618588833548,
      "longitude": 153.5093004808961
    }
  ],
  "helicopterApron": [
    {
      "latitude": -28.16139534786845,
      "longitude": 153.50888990213386
    },
    {
      "latitude": -28.161884924614697,
      "longitude": 153.5094629401185
    },
    {
      "latitude": -28.161996901960062,
      "longitude": 153.5094215868619
    },
    {
      "latitude": -28.16199169371404,
      "longitude": 153.5093093423082
    },
    {
      "latitude": -28.161496909186074,
      "longitude": 153.5087806113842
    }
  ],
  "sharedAreas": [
    {
      "id": "training-parking",
      "label": "Shared light-aircraft parking",
      "openBoundary": true,
      "polygon": [
        {
          "latitude": -28.16043337635692,
          "longitude": 153.50751650000004
        },
        {
          "latitude": -28.161380771300177,
          "longitude": 153.50856950000002
        },
        {
          "latitude": -28.16124747000607,
          "longitude": 153.50871260000002
        },
        {
          "latitude": -28.16113083123754,
          "longitude": 153.50855060000004
        },
        {
          "latitude": -28.16042147435705,
          "longitude": 153.50772710000004
        }
      ]
    },
    {
      "id": "hangar-front-parking",
      "label": "Hangar-front parking",
      "polygon": [
        {
          "latitude": -28.16039767035336,
          "longitude": 153.50808350000003
        },
        {
          "latitude": -28.161057039297926,
          "longitude": 153.50888000000003
        },
        {
          "latitude": -28.160980866919793,
          "longitude": 153.50895830000005
        },
        {
          "latitude": -28.160319117103615,
          "longitude": 153.50817530000003
        }
      ]
    }
  ],
  "observedAircraft": [
    {
      "id": "ga-observed-1",
      "aircraftId": "c172",
      "headingDeg": 75,
      "latitude": -28.16059286302736,
      "longitude": 153.50790260000002
    },
    {
      "id": "ga-observed-2",
      "aircraftId": "c172",
      "headingDeg": 75,
      "latitude": -28.160704741594632,
      "longitude": 153.50798360000002
    },
    {
      "id": "ga-observed-3",
      "aircraftId": "c172",
      "headingDeg": -105,
      "latitude": -28.160954682652296,
      "longitude": 153.50810240000004
    },
    {
      "id": "ga-observed-4",
      "aircraftId": "c172",
      "headingDeg": -105,
      "latitude": -28.161028474662494,
      "longitude": 153.50818340000004
    },
    {
      "id": "ga-observed-5",
      "aircraftId": "c172",
      "headingDeg": 75,
      "latitude": -28.160935639544636,
      "longitude": 153.5082752
    },
    {
      "id": "ga-observed-6",
      "aircraftId": "c172",
      "headingDeg": 75,
      "latitude": -28.161023713889165,
      "longitude": 153.50836970000003
    },
    {
      "id": "ga-observed-7",
      "aircraftId": "c172",
      "headingDeg": 75,
      "latitude": -28.16110940777645,
      "longitude": 153.50846690000003
    },
    {
      "id": "ga-observed-8",
      "aircraftId": "c172",
      "headingDeg": -105,
      "latitude": -28.161183199679954,
      "longitude": 153.50836160000003
    },
    {
      "id": "ga-observed-9",
      "aircraftId": "c172",
      "headingDeg": 75,
      "latitude": -28.160716643563013,
      "longitude": 153.50858570000003
    },
    {
      "id": "ga-observed-10",
      "aircraftId": "c172",
      "headingDeg": -105,
      "latitude": -28.16096182381679,
      "longitude": 153.50879900000004
    },
    {
      "id": "ga-observed-11",
      "aircraftId": "c172",
      "headingDeg": 75,
      "latitude": -28.161028474662494,
      "longitude": 153.50888540000003
    }
  ]
};
