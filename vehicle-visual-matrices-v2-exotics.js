(function () {
  const source = {
    ...(window.vehicleVisualMatricesEurope || {}),
    ...(window.vehicleVisualMatricesExotics || {}),
    ...(window.vehicleVisualMatricesModern || {})
  };
  const ids = [
    "lamborghinirevuelto",
    "lamborghinisterrato",
    "lamborghiniurusse",
    "lamborghinitemerario",
    "lamborghinicountachlpi800",
    "lamborghinihuracantecnica",
    "lamborghiniaventadorsvj",
    "mercedesamggt63",
    "mercedesamgsl63",
    "mercedesamgg63",
    "mercedesamgeqs53",
    "mercedesamgc63",
    "mercedesamgs63",
    "mercedesamggls63"
  ];

  const genericMatrixIds = new Set([
    "lamborghinirevuelto",
    "lamborghinisterrato",
    "lamborghiniurusse",
    "lamborghinitemerario",
    "lamborghinicountachlpi800",
    "lamborghinihuracantecnica",
    "lamborghiniaventadorsvj",
    "mercedesamggt63"
  ]);

  function imagePath(id, trim, paintId, paintIndex) {
    const prefix = `assets/cars/imagegen-matrix-v2/${id}-t${trim}-`;

    if (genericMatrixIds.has(id)) {
      return `${prefix}${["base", "paint2", "paint3", "alt"][paintIndex]}-standard.png`;
    }

    if (id === "mercedesamgsl63") {
      if (paintId === "patagonia") return `${prefix}base-standard.png`;
      if (paintId === "obsidian") return `${prefix}alt-standard.png`;
      if (paintId === "alpine" && trim < 2) return `${prefix}paint2-standard.png`;
      return `${prefix}${paintId}-standard.png`;
    }

    return paintIndex === 0
      ? `${prefix}base-standard.png`
      : `${prefix}${paintId}-standard.png`;
  }

  window.vehicleVisualMatricesExotics = Object.fromEntries(ids.map((id) => {
    const definition = source[id];
    if (!definition) throw new Error(`Missing base vehicle visual matrix: ${id}`);

    const trims = [...new Set(Object.keys(definition.images).map((key) => Number(key.split("-")[0])))];
    const images = {};

    trims.forEach((trim) => {
      definition.paint.forEach(([paintId], paintIndex) => {
        images[`${trim}-${paintId}-standard`] = imagePath(id, trim, paintId, paintIndex);
      });
    });

    return [id, { paint: definition.paint.map((paint) => [...paint]), images }];
  }));
})();
