const INDIA_GEO_BOUNDS = Object.freeze({
  minLat: 6,
  maxLat: 38,
  minLng: 68,
  maxLng: 98,
});

const HOTSPOT_GRID_SIZE_DEGREES = 0.1;
const HOTSPOT_RADIUS_METERS = 5500;

const latBucketCount = Math.ceil(
  (INDIA_GEO_BOUNDS.maxLat - INDIA_GEO_BOUNDS.minLat) / HOTSPOT_GRID_SIZE_DEGREES
);
const lngBucketCount = Math.ceil(
  (INDIA_GEO_BOUNDS.maxLng - INDIA_GEO_BOUNDS.minLng) / HOTSPOT_GRID_SIZE_DEGREES
);

const hotspotZoneBoundaries = Array.from(
  { length: latBucketCount * lngBucketCount + 1 },
  (_, index) => index
);

const hotspotSeverityProjection = {
  $switch: {
    branches: [
      { case: { $gte: ['$count', 5] }, then: 'high' },
      { case: { $gte: ['$count', 3] }, then: 'medium' },
    ],
    default: 'low',
  },
};

const getHotspotPreparationStages = () => [
  {
    $project: {
      status: 1,
      priority: 1,
      locationSource: 1,
      assignedTo: 1,
      createdAt: 1,
      lat: { $arrayElemAt: ['$location.coordinates', 1] },
      lng: { $arrayElemAt: ['$location.coordinates', 0] },
    },
  },
  {
    $match: {
      lat: {
        $gte: INDIA_GEO_BOUNDS.minLat,
        $lt: INDIA_GEO_BOUNDS.maxLat,
      },
      lng: {
        $gte: INDIA_GEO_BOUNDS.minLng,
        $lt: INDIA_GEO_BOUNDS.maxLng,
      },
    },
  },
  {
    $project: {
      status: 1,
      priority: 1,
      locationSource: 1,
      assignedTo: 1,
      createdAt: 1,
      lat: 1,
      lng: 1,
      latBucket: {
        $floor: {
          $divide: [
            { $subtract: ['$lat', INDIA_GEO_BOUNDS.minLat] },
            HOTSPOT_GRID_SIZE_DEGREES,
          ],
        },
      },
      lngBucket: {
        $floor: {
          $divide: [
            { $subtract: ['$lng', INDIA_GEO_BOUNDS.minLng] },
            HOTSPOT_GRID_SIZE_DEGREES,
          ],
        },
      },
    },
  },
  {
    $project: {
      status: 1,
      priority: 1,
      locationSource: 1,
      assignedTo: 1,
      createdAt: 1,
      lat: 1,
      lng: 1,
      zoneId: {
        $add: [
          { $multiply: ['$latBucket', lngBucketCount] },
          '$lngBucket',
        ],
      },
    },
  },
];

const getHotspotBucketStages = (minimumReports = 2) => [
  {
    $bucket: {
      groupBy: '$zoneId',
      boundaries: hotspotZoneBoundaries,
      default: 'outOfRange',
      output: {
        count: { $sum: 1 },
        avgLat: { $avg: '$lat' },
        avgLng: { $avg: '$lng' },
        minLat: { $min: '$lat' },
        maxLat: { $max: '$lat' },
        minLng: { $min: '$lng' },
        maxLng: { $max: '$lng' },
      },
    },
  },
  {
    $match: {
      _id: { $ne: 'outOfRange' },
      count: { $gte: minimumReports },
    },
  },
  {
    $project: {
      _id: 0,
      zoneId: '$_id',
      count: 1,
      lat: '$avgLat',
      lng: '$avgLng',
      bounds: {
        south: '$minLat',
        north: '$maxLat',
        west: '$minLng',
        east: '$maxLng',
      },
      radiusMeters: { $literal: HOTSPOT_RADIUS_METERS },
      severity: hotspotSeverityProjection,
    },
  },
  {
    $sort: {
      count: -1,
    },
  },
];

const buildHotspotAggregation = (baseMatch = {}, minimumReports = 2) => {
  const stages = [];

  if (Object.keys(baseMatch).length > 0) {
    stages.push({ $match: baseMatch });
  }

  return [
    ...stages,
    ...getHotspotPreparationStages(),
    ...getHotspotBucketStages(minimumReports),
  ];
};

const buildAnalyticsPipeline = (baseMatch = {}) => {
  const stages = [];
  const lastSevenDays = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);

  if (Object.keys(baseMatch).length > 0) {
    stages.push({ $match: baseMatch });
  }

  return [
    ...stages,
    {
      $facet: {
        statusBreakdown: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ],
        priorityBreakdown: [
          {
            $group: {
              _id: '$priority',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ],
        locationSourceBreakdown: [
          {
            $group: {
              _id: '$locationSource',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ],
        assignmentBreakdown: [
          {
            $match: {
              assignedTo: { $ne: null },
            },
          },
          {
            $group: {
              _id: '$assignedTo',
              totalAssigned: { $sum: 1 },
              resolved: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0],
                },
              },
              pending: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0],
                },
              },
              highPriorityOpen: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$priority', 'high'] },
                        { $ne: ['$status', 'resolved'] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              officerId: '$_id',
              totalAssigned: 1,
              resolved: 1,
              pending: 1,
              highPriorityOpen: 1,
              resolutionRate: {
                $cond: [
                  { $eq: ['$totalAssigned', 0] },
                  0,
                  {
                    $multiply: [
                      { $divide: ['$resolved', '$totalAssigned'] },
                      100,
                    ],
                  },
                ],
              },
            },
          },
          { $sort: { totalAssigned: -1, officerId: 1 } },
        ],
        dailyVolume: [
          {
            $match: {
              createdAt: { $gte: lastSevenDays },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        hotspotZones: [
          ...getHotspotPreparationStages(),
          ...getHotspotBucketStages(2),
        ],
      },
    },
  ];
};

const toBreakdownMap = (entries, defaultKey = 'unknown') =>
  entries.reduce((accumulator, entry) => {
    accumulator[entry._id || defaultKey] = entry.count;
    return accumulator;
  }, {});

const normalizeAnalytics = (analyticsResult = {}) => {
  const status = toBreakdownMap(analyticsResult.statusBreakdown || []);
  const priority = toBreakdownMap(analyticsResult.priorityBreakdown || []);
  const locationSource = toBreakdownMap(
    analyticsResult.locationSourceBreakdown || [],
    'unknown'
  );
  const hotspots = analyticsResult.hotspotZones || [];

  return {
    totals: {
      reports:
        Object.values(status).reduce((sum, count) => sum + count, 0),
      hotspots: hotspots.length,
    },
    status,
    priority,
    locationSource,
    assignmentBreakdown: analyticsResult.assignmentBreakdown || [],
    dailyVolume: (analyticsResult.dailyVolume || []).map((entry) => ({
      date: entry._id,
      count: entry.count,
    })),
    hotspots,
  };
};

module.exports = {
  HOTSPOT_RADIUS_METERS,
  buildHotspotAggregation,
  buildAnalyticsPipeline,
  normalizeAnalytics,
};
