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
- Wrapped NEX contract for ERC-20 swaps and LP
- Official NEX faucet link for Nexus testnet gas
- Injected wallet picker plus optional WalletConnect support

Legacy entry files redirect to `dex.html` so the project now opens as NEXUS DEX only.

## WalletConnect

WalletConnect requires a free project id from Reown:

1. Create a project at `https://cloud.reown.com`.
2. Copy the project id.
3. Paste it into `dex.html`:

```html
<script>
  window.NEXUS_WALLETCONNECT_PROJECT_ID = "YOUR_PROJECT_ID";
</script>
```

After that, the Connect button will show a WalletConnect option for QR/mobile wallet connections.

## Contracts

- `USDXTestToken.sol`: rate-limited test USDX faucet token.
- `WrappedNEX.sol`: wraps native NEX into ERC-20 WNEX for swaps and liquidity pools.
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
const ROUTER_ADDRESS = "YOUR_ROUTER_ADDRESS";
const USDX_ADDRESS = "YOUR_USDX_ADDRESS";
const WNEX_ADDRESS = "YOUR_WRAPPED_NEX_ADDRESS";
```

## Test Swap / LP Flow

Native `NEX` is gas, not an ERC-20 token. The router can only swap ERC-20 tokens, so use this flow:

1. Get NEX gas from the Nexus faucet.
2. Claim USDX in the app.
3. Wrap some NEX into WNEX in the app.
4. Add liquidity with `WNEX / USDX`.
5. Swap `WNEX -> USDX` or `USDX -> WNEX`.

Security defaults:

- Wallet connect switches/adds Nexus testnet before actions.
- USDX faucet has a local cooldown and sends a real testnet transaction.
- Swaps and LP deposits require configured live ERC-20 token addresses. Use WNEX for native NEX exposure.
- Router has deadline and minimum-output checks.
- Pair contract has a simple reentrancy lock around mint/burn/swap.
- Use test wallets and audited contracts before handling real funds.
