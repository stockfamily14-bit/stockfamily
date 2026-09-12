import { config } from 'dotenv'
config({ path: '.env.local' })

import { reconcileDailyOHLC } from '../src/lib/insight/reconcile'

async function run() {
  console.log('Menjalankan rekonsiliasi insight harian (OHLC High/Low)...')
  const result = await reconcileDailyOHLC()
  console.log(
    `Rekonsiliasi selesai: ${result.processed} insight diproses, ${result.daysApplied} hari OHLC diterapkan, ${result.errors.length} error.`
  )
  if (result.errors.length > 0) {
    console.error('Reconcile errors:', result.errors)
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error('Fatal error saat reconcile:', error)
  process.exitCode = 1
})