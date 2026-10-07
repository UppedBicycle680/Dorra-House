(function () {
  const current = window.vehicleVisualMatricesModern || {};
  const ids = ["audirs7", "audirs6avant", "audirsq8", "audietrongt"];
  const audi = {};

  ids.forEach((id) => {
    const definition = current[id];
    if (!definition) throw new Error(`Missing base modern vehicle visual matrix: ${id}`);

    const trims = [...new Set(Object.keys(definition.images).map((key) => Number(key.split("-")[0])))];
    const images = {};

    trims.forEach((trim) => {
      definition.paint.forEach(([paintId]) => {
        images[`${trim}-${paintId}-standard`] =
          `assets/cars/imagegen-matrix-v2/${id}-t${trim}-${paintId}-standard.png`;
      });
    });

    audi[id] = {
      paint: definition.paint.map((paint) => [...paint]),
      images
    };
  });

  window.vehicleVisualMatricesModern = { ...current, ...audi };
})();
