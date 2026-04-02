import { NextRequest, NextResponse } from 'next/server'
import { createFreshPublicClient } from '@/lib/viemClient'
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace'
import { bytes8ToGeohash, geohashToBytes8 } from '@/lib/geohash'
import { getIpfsUrl } from '@/lib/pinata'

interface LocalProduce {
  produceName: string
  category: string
  sellerCount: number
}

/**
 * GET /api/garden-ai/local?geohash=djq8
 *
 * Returns aggregated info about what's being sold near a geohash.
 * Used by the Garden AI to know what neighbors are growing.
 */
export async function GET(request: NextRequest) {
  const geohash = request.nextUrl.searchParams.get('geohash')
  if (!geohash || geohash.length < 4) {
    return NextResponse.json({ produce: [], totalSellers: 0 })
  }

  try {
    const client = createFreshPublicClient()
    const prefix = geohash.slice(0, 4) // ~20km radius
    const bytes8Prefix = geohashToBytes8(prefix)

    // Get seller count for this geohash prefix
    const sellerCount = await client.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'getSellerCountByGeohash',
      args: [bytes8Prefix],
    }) as bigint

    if (sellerCount === 0n) {
      return NextResponse.json({ produce: [], totalSellers: 0 })
    }

    // Get all seller IDs in this area
    const sellerIds: bigint[] = []
    const count = Number(sellerCount)
    for (let i = 0; i < Math.min(count, 20); i++) { // cap at 20 sellers
      try {
        const sellerId = await client.readContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'sellersByGeohash',
          args: [bytes8Prefix, BigInt(i)],
        }) as bigint
        sellerIds.push(sellerId)
      } catch { break }
    }

    // Get total listing count
    const nextListingId = await client.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'nextListingId',
    }) as bigint

    // Scan listings for ones from nearby sellers
    const produceMap = new Map<string, { category: string; sellers: Set<string> }>()
    const totalListings = Number(nextListingId)

    for (let i = 1; i < totalListings && i <= 100; i++) { // cap scan at 100
      try {
        const listing = await client.readContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'listings',
          args: [BigInt(i)],
        }) as [bigint, string, bigint, bigint, boolean]

        const [sellerId, metadataIpfs, , quantityAvailable, active] = listing
        if (!active || quantityAvailable === 0n) continue
        if (!sellerIds.includes(sellerId)) continue

        // Fetch IPFS metadata for produce name
        try {
          let metadata: { produceName?: string; category?: string } | null = null
          if (metadataIpfs.startsWith('test-')) {
            // Test data
            metadata = { produceName: metadataIpfs.replace('test-', ''), category: 'produce' }
          } else if (metadataIpfs.startsWith('{')) {
            metadata = JSON.parse(metadataIpfs)
          } else {
            const url = getIpfsUrl(metadataIpfs)
            const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
            if (res.ok) metadata = await res.json()
          }

          if (metadata?.produceName) {
            const name = metadata.produceName
            const existing = produceMap.get(name)
            if (existing) {
              existing.sellers.add(sellerId.toString())
            } else {
              produceMap.set(name, {
                category: metadata.category || 'produce',
                sellers: new Set([sellerId.toString()]),
              })
            }
          }
        } catch {
          // Skip listings with unreadable metadata
        }
      } catch { break }
    }

    const produce: LocalProduce[] = Array.from(produceMap.entries()).map(
      ([produceName, { category, sellers }]) => ({
        produceName,
        category,
        sellerCount: sellers.size,
      })
    )

    return NextResponse.json({
      produce,
      totalSellers: count,
    })
  } catch (err) {
    console.error('[Garden AI Local] Error:', err)
    return NextResponse.json({ produce: [], totalSellers: 0 })
  }
}
