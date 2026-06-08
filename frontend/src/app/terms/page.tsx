import Link from 'next/link';

export const metadata = {
  title: 'Terms & Privacy — Local Roots',
  description: 'Terms of Service and Privacy Policy for Local Roots, a peer-to-peer marketplace for community gardeners.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-roots-gray hover:text-roots-primary underline">
            ← Back to Local Roots
          </Link>
        </div>

        <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">
          Terms & Privacy
        </h1>
        <p className="text-sm text-roots-gray mb-8">
          Last updated June 4, 2026
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-10 text-sm text-amber-900">
          <p className="font-semibold mb-1">Pre-launch draft</p>
          <p>
            Local Roots is in early operation. These terms describe how the
            marketplace works and the ground rules we ask buyers and sellers
            to agree to. We&apos;ll formalize this with legal review before
            broad expansion. Questions or concerns?{' '}
            <a
              href="mailto:feedback@localroots.love"
              className="underline font-medium"
            >
              feedback@localroots.love
            </a>
          </p>
        </div>

        <div className="prose prose-sm md:prose-base max-w-none">
          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold mb-3">
              1. What Local Roots is — and isn&apos;t
            </h2>
            <p>
              Local Roots is a <strong>decentralized peer-to-peer
              marketplace protocol</strong>. Backyard gardeners list surplus
              produce. Neighbors buy it directly. The platform provides
              the rails — open-source smart contracts on Base, IPFS for
              listing data, decentralized payment in USDC.
            </p>
            <p>
              <strong>Local Roots is not the seller. Local Roots is not
              the buyer. Local Roots is not the food producer, the
              custodian of payments, or the arbiter of disputes.</strong>
            </p>
            <ul>
              <li>
                <strong>Sellers</strong> list and sell directly to buyers.
                The seller is the food producer, the merchant, and the
                party legally responsible for what they sell.
              </li>
              <li>
                <strong>Buyers</strong> purchase directly from sellers. Funds
                go from the buyer&apos;s wallet, through an on-chain escrow
                smart contract, to the seller&apos;s wallet. Local Roots does
                not hold or custody buyer funds at any time.
              </li>
              <li>
                <strong>Disputes</strong> are decided by Local Roots
                ambassadors — a community of users who have earned voting
                rights through participation. Voting is on-chain. Local
                Roots staff do not unilaterally decide dispute outcomes.
              </li>
              <li>
                <strong>Zero platform fees.</strong> Every dollar paid by a
                buyer goes to the seller, minus blockchain network fees
                (which go to validators, not us).
              </li>
            </ul>
            <p>
              By design, Local Roots operates as infrastructure rather than
              as a centralized service provider. This is the same model
              the broader open internet uses: protocols facilitate
              transactions; the parties to those transactions remain
              responsible for what they do.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold mb-3">
              2. Sellers
            </h2>
            <p>By listing produce on Local Roots, you agree to:</p>
            <ul>
              <li>
                <strong>Sell only food you grew yourself</strong> (or that
                came from your garden, household, or community garden plot).
                Reselling commercially-purchased produce is not allowed.
              </li>
              <li>
                <strong>Be honest about what you&apos;re selling</strong> —
                accurate variety, condition, harvest date, growing methods.
                Photos should show your actual produce, not stock images.
              </li>
              <li>
                <strong>Comply with local food-safety laws</strong> in your
                jurisdiction. Different states and counties have different
                rules about cottage-food sales, fresh produce, eggs, honey,
                etc. <em>Local Roots does not certify, inspect, or guarantee
                the safety of any food sold through the platform.</em> You
                are the food producer; the legal responsibility for food
                safety is yours.
              </li>
              <li>
                <strong>Honor the orders you accept</strong> — fulfill within
                a reasonable time, communicate with buyers if there&apos;s a
                problem, and don&apos;t cancel orders without good reason.
              </li>
              <li>
                <strong>Set fair prices</strong> and stand behind them. No
                bait-and-switch.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold mb-3">
              3. Buyers
            </h2>
            <p>By buying produce on Local Roots, you agree to:</p>
            <ul>
              <li>
                <strong>Order in good faith.</strong> Don&apos;t place orders
                you can&apos;t pay for or won&apos;t pick up.
              </li>
              <li>
                <strong>Inspect produce when you receive it.</strong> If
                something is wrong with the order, raise it through the
                platform&apos;s dispute system within 48 hours.
              </li>
              <li>
                <strong>Use your own judgment about food safety.</strong> The
                produce you buy comes from another person&apos;s garden. We
                strongly recommend washing all produce, cooking when
                appropriate, and trusting your senses. If something looks or
                smells off, don&apos;t eat it.
              </li>
              <li>
                <strong>Show up for pickup orders</strong> at the agreed
                time, or coordinate a different time with the seller in
                advance.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold mb-3">
              4. Disputes
            </h2>
            <p>
              If a transaction goes wrong, the buyer can raise a dispute
              within 48 hours of order completion. Disputes are resolved by
              Local Roots ambassadors (community members who have earned
              voting rights through their participation). Both parties
              submit evidence; ambassadors vote; majority rules.
            </p>
            <p>
              <strong>Local Roots does not unilaterally decide disputes.</strong>{' '}
              The ambassador-voting process is on-chain and transparent. If
              the dispute window expires without action, funds release to
              the seller automatically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold mb-3">
              5. Acceptable use
            </h2>
            <p>You may not use Local Roots to:</p>
            <ul>
              <li>Sell illegal substances, prescription drugs, or anything regulated by the FDA, DEA, or comparable agencies in your jurisdiction</li>
              <li>Sell raw milk, raw meat, or other foods prohibited by local cottage-food laws</li>
              <li>Defraud or deceive other users</li>
              <li>Harass, threaten, or abuse other users</li>
              <li>Manipulate the ambassador rewards system, run sock-puppet accounts, or exploit anti-fraud mechanisms</li>
              <li>Reverse-engineer, copy, or compete with the platform without permission</li>
            </ul>
            <p>
              Violations can result in account suspension, on-chain seller
              suspension, and permanent removal from the marketplace.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold mb-3">
              6. Disclaimer of warranties &amp; limitation of liability
            </h2>
            <p>
              Local Roots is open-source decentralized infrastructure. Smart
              contracts execute autonomously on the Base blockchain. The
              platform is provided <strong>&ldquo;as is&rdquo;</strong> with
              no warranties of any kind, express or implied.
            </p>
            <p>
              <strong>Because Local Roots is not a party to transactions,
              not a custodian of funds, not the food producer, and not the
              arbiter of disputes, Local Roots — including its founders,
              contributors, ambassadors acting in their capacity, and
              partners — disclaims all liability for:</strong>
            </p>
            <ul>
              <li>
                Any harm caused by food sold or bought through the platform.
                <strong> The seller is the food producer; legal
                responsibility for food safety lies with the seller and
                applicable food-safety regulators in their jurisdiction,
                not Local Roots.</strong>
              </li>
              <li>
                Disputes between buyers and sellers. The on-chain dispute
                resolution mechanism is the agreed-upon process; outcomes
                are decided by ambassador voting, not by Local Roots.
              </li>
              <li>
                Lost, delayed, or failed transactions, including those
                caused by blockchain network conditions, smart contract
                bugs, or wallet/key issues outside our control.
              </li>
              <li>
                Loss of access to your wallet, embedded wallet recovery
                keys, or any consequence of losing such access.
              </li>
              <li>
                Failures, outages, or data exposure by third-party services
                we depend on (Privy, Pinata/IPFS, Base/Ethereum,
                payment processors, hosting providers). These services
                have their own terms; you accept those when you use them.
              </li>
              <li>
                Use of the platform in jurisdictions where peer-to-peer food
                sales, cottage food sales, or cryptocurrency transactions
                are restricted or prohibited.
              </li>
            </ul>
            <p>
              <strong>You use Local Roots at your own risk.</strong> If
              you&apos;re unsure whether you should buy, sell, or use this
              platform in your jurisdiction, don&apos;t.
            </p>
            <p>
              <strong>Maximum aggregate liability:</strong> in any
              jurisdiction where the above disclaimers cannot be fully
              enforced, Local Roots&apos;s aggregate liability to any user
              is limited to the amount that user has paid Local Roots in
              the preceding 12 months. Local Roots charges zero fees, so
              this amount is zero.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold mb-3">
              7. Privacy
            </h2>
            <p>
              <strong>What we collect:</strong>
            </p>
            <ul>
              <li>
                <strong>Account info</strong> — your email or social login
                (via Privy), and an embedded wallet address generated when
                you sign up
              </li>
              <li>
                <strong>Profile info you provide</strong> — name, garden
                description, photos
              </li>
              <li>
                <strong>Transaction data</strong> — orders, listings, on-chain
                events (these are public on the Base blockchain)
              </li>
              <li>
                <strong>Pickup &amp; delivery addresses</strong> — stored
                privately and only shared with the counterparty after a
                confirmed order
              </li>
              <li>
                <strong>Sage conversations</strong> — your gardening AI
                chats are stored so Sage can remember your garden across
                sessions
              </li>
              <li>
                <strong>Approximate location</strong> — encoded as a
                geohash, used for buyer-seller matching by neighborhood
              </li>
            </ul>
            <p>
              <strong>What we don&apos;t do:</strong> We don&apos;t sell your
              personal data. We don&apos;t share contact info between users
              without an active order. We don&apos;t advertise to you.
            </p>
            <p>
              <strong>Third parties we work with:</strong> Privy
              (authentication), Pinata (IPFS image hosting), Vercel
              (hosting + KV storage), Anthropic (Sage AI), Base (blockchain).
              Each has its own privacy practices.
            </p>
            <p>
              <strong>Your rights:</strong> You can delete your account
              data by emailing us at{' '}
              <a
                href="mailto:feedback@localroots.love"
                className="underline"
              >
                feedback@localroots.love
              </a>
              . On-chain transaction data cannot be deleted (it&apos;s the
              nature of public blockchains), but we can disconnect your
              wallet from your profile and remove off-chain data we hold
              about you.
            </p>

            <h3 className="font-heading text-xl font-bold mt-6 mb-3">
              Site analytics
            </h3>
            <p>
              We use a small, first-party script on localroots.love to
              understand which pages help our gardeners and which emails
              actually land. It stores two cookies in your browser (a
              visitor ID and a session ID), and records anonymous things
              like which pages you visited and how long you spent on each.
              Your IP address is one-way hashed before storage — we never
              write your raw IP to disk, and after about a day the hash
              can no longer be reversed.
            </p>
            <p>
              If you arrive at our site from one of our emails, the link
              tells us you&apos;re the person we sent it to, so when you
              say &ldquo;yes I&apos;d like more info&rdquo; later, we
              already know who you are. Similarly, if you fill out a
              contact form on this site, we associate your email with the
              pages you visited so our follow-up conversation is actually
              informed.
            </p>
            <p>
              We don&apos;t sell this data, share it with advertisers, or
              use it to follow you around the web. We use it for one
              thing: making Local Roots better at helping gardens grow.
            </p>
            <p>
              <strong>Don&apos;t want any of this?</strong> Visit our{' '}
              <Link href="/privacy-preferences" className="underline">
                privacy preferences page
              </Link>{' '}
              and toggle analytics off. You can also email us at{' '}
              <a href="mailto:doug@localroots.love" className="underline">
                doug@localroots.love
              </a>{' '}
              to request deletion of all data tied to your visits.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold mb-3">
              8. Changes to these terms
            </h2>
            <p>
              We&apos;ll update these terms as Local Roots grows and our
              legal review formalizes them. Material changes will be
              announced on the platform. Continued use after a change
              constitutes acceptance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold mb-3">
              9. Contact
            </h2>
            <p>
              Questions, complaints, abuse reports:{' '}
              <a
                href="mailto:feedback@localroots.love"
                className="underline font-medium"
              >
                feedback@localroots.love
              </a>
            </p>
            <p>
              Local Roots is operated by Common Area, a Delaware LLC.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
