import { expect, test } from '@playwright/test'

test('pagina auth disponibile in viewport iPhone', async ({ page }) => {
  await page.goto('/')

  const setupHeading = page.getByRole('heading', { name: 'Configura Supabase' })

  if (await setupHeading.isVisible()) {
    await expect(setupHeading).toBeVisible()
    await expect(page.getByText('VITE_SUPABASE_URL')).toBeVisible()
    return
  }

  await expect(page.getByRole('heading', { name: 'Mio Patrimonio' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrati' })).toBeVisible()
})
