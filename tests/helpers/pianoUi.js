export async function toggleSettings(page) {
  const trigger = page.getByRole('button', { name: 'Settings', exact: true });
  if (await trigger.getAttribute('aria-expanded') === 'true') await closeSettings(page);
  else await trigger.click();
}

export async function openSettings(page) {
  const trigger = page.getByRole('button', { name: 'Settings', exact: true });
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  const controls = page.getByRole('button', { name: 'Controls', exact: true });
  if (await controls.getAttribute('aria-current') !== 'page') await controls.click();
}

export async function closeSettings(page) {
  if (await page.getByRole('button', { name: 'Settings', exact: true }).getAttribute('aria-expanded') === 'true') {
    await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  }
}

export async function goTo(page, name) {
  if (name === 'Play') return closeSettings(page);
  await openSettings(page);
  await page.getByRole('button', { name, exact: true }).click();
}

export async function clickControl(page, name) {
  await openSettings(page);
  await page.getByRole('button', { name, exact: true }).click();
}

export async function fillTempo(page, value) {
  await openSettings(page);
  await page.getByRole('slider', { name: 'Tempo', exact: true }).fill(value);
}
