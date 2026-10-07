(() => {
  const modernIds = [
    'mazdamx5', 'mazdacx90', 'mazda3', 'mazdacx5',
    'rangesport', 'rangevelar', 'rangeevoque', 'defender110',
    'teslas', 'teslamodel3', 'teslamodelx', 'cybertruck'
  ];
  const source = window.vehicleVisualMatricesModern || {};
  const matrices = {};

  modernIds.forEach((id) => {
    const original = source[id];
    if (!original) return;
    matrices[id] = {
      paint: original.paint.map((paint) => [...paint]),
      images: Object.fromEntries(
        Object.entries(original.images).map(([key, path]) => [
          key,
          path.replace('assets/cars/matrix/', 'assets/cars/imagegen-matrix-v2/')
        ])
      )
    };
  });

  window.vehicleVisualMatricesModern = { ...source, ...matrices };
})();
