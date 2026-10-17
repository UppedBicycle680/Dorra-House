// Public geography only: this helper uses the documented flat-map projection
// and ordinary keyboard/pointer input. It never reads private match state or
// installs a map instance, order, position or camera through a test hook.
export async function targetMapPoint(page, { lng, lat }, { touch = page.viewportSize()?.width <= 700, zoomSteps = 12 } = {}) {
  const canvas = page.locator('#worldCanvas');
  await canvas.focus(); await page.keyboard.press('h');
  for (let index = 0; index < zoomSteps; index++) await page.keyboard.press('+');
  const bounds = await canvas.boundingBox();
  const panel = await page.locator('#selectionPanel').isVisible() ? await page.locator('#selectionPanel').boundingBox() : null;
  const resources = await page.locator('#resourceBar').boundingBox();
  const top = Math.max(0, (resources?.y || bounds.y) + (resources?.height || 0) - bounds.y) + 18;
  const bottom = Math.max(top + 50, (panel?.y || bounds.y + bounds.height) - bounds.y - 22);
  const anchor = { x: bounds.width * (touch ? .4 : .7), y: touch ? (top + bottom) / 2 : bounds.height * .3 };
  const zoom = Math.min(28, 1.3 ** zoomSteps), scale = Math.min(bounds.width / 360, bounds.height / 165) * zoom;
  const camera = { x: Math.max(0, Math.min(360, Number(lng) + 180 + (bounds.width / 2 - anchor.x) / scale)), y: Math.max(5, Math.min(175, 90 - Number(lat) + (bounds.height / 2 - anchor.y) / scale)) };
  let dx = (180 - camera.x) * scale, dy = (88 - camera.y) * scale;
  const gesture = touch ? await page.context().newCDPSession(page) : null;
  try {
    while (Math.abs(dx) > .01 || Math.abs(dy) > .01) {
      const stepX = Math.max(-60, Math.min(60, dx)), stepY = Math.max(-60, Math.min(60, dy));
      // Start on the unobstructed map centre: the mobile Map button occupies
      // the old left-edge gesture origin on narrow phones.
      const x = bounds.x + (touch ? bounds.width * .5 : Math.max(180, bounds.width * .2)), y = bounds.y + top + (stepY < 0 ? 80 : 15);
      if (gesture) {
        await gesture.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await gesture.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + stepX, y: y + stepY, id: 1 }] });
        await gesture.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + stepX, y + stepY, { steps: 3 }); await page.mouse.up();
      }
      dx -= stepX; dy -= stepY;
    }
  } finally { await gesture?.detach(); }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const target = { x: bounds.x + bounds.width / 2 + (Number(lng) + 180 - camera.x) * scale, y: bounds.y + bounds.height / 2 + (90 - Number(lat) - camera.y) * scale };
  if (touch) await page.touchscreen.tap(target.x, target.y); else await page.mouse.click(target.x, target.y);
  return { ...target, zoom };
}
