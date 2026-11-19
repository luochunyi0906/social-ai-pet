export async function skipGuide(page) {
  const skip = page.getByRole('button', { name: '跳过教程', exact: true });
  const pet = page.locator('.desktop-pet');
  await skip.or(pet).first().waitFor();
  if (await skip.isVisible()) await skip.click();
  await pet.waitFor();
}
