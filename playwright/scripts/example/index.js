module.exports.run = async ({ page }) => {
  await page.goto('https://example.com')
  await page.waitForLoadState('domcontentloaded')
}
