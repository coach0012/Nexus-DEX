# NEXUS DEX

Single-page DEX aggregator prototype for Nexus, plus deploy-ready testnet contracts.

## Features

- Swap panel with pay/receive layout
- Slippage and deadline controls
- Local quote, price impact, and route display
- Liquidity pool creation/add flow
- Pool value and position count
- Recent swap activity
- USDX test-token faucet flow
- Official NEX faucet link for Nexus testnet gas

Legacy entry files redirect to `dex.html` so the project now opens as NEXUS DEX only.

## Contracts

- `USDXTestToken.sol`: rate-limited test USDX faucet token.
- `NexusDexFactory.sol`: creates token pair pools.
- `NexusDexPair.sol`: constant-product AMM pair with LP token accounting.
- `NexusDexRouter.sol`: add liquidity and swap exact tokens with deadline/slippage checks.

## Deploy To Nexus Testnet

1. Copy `.env.example` to `.env`.
2. Set `PRIVATE_KEY` to a fresh testnet deployer wallet key. Never use your main wallet.
3. Get test NEX from `https://faucet.nexus.xyz`.
4. Install dependencies:
   `npm.cmd install`
5. Deploy:
   `npm.cmd run deploy:testnet`

After deployment, paste the printed addresses into `app.js`:

```js
const routerAddress = "YOUR_ROUTER_ADDRESS";
const usdxFaucetAddress = "YOUR_USDX_ADDRESS";
```

Until those addresses are configured, the frontend keeps swaps and LP actions in local demo mode.

Security defaults:

- Wallet connect switches/adds Nexus testnet before actions.
- USDX faucet has a local cooldown.
- Swaps and LP deposits remain simulated unless contract addresses are explicitly configured.
- Router has deadline and minimum-output checks.
- Pair contract has a simple reentrancy lock around mint/burn/swap.
- Use test wallets and audited contracts before handling real funds.
