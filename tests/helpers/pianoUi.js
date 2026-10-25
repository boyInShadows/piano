export async function toggleSettings(page) {
  const trigger = page.getByRole('button', { name: 'Settings', exact: true });
  if (await trigger.getAttribute('aria-expanded') === 'true') await page.keyboard.press('Escape');
  else await trigger.click();
}
