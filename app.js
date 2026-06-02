const swapKey = "nexusdex.live.swaps.v1";
const poolKey = "nexusdex.live.pools.v1";
const balancesKey = "nexusdex.live.balances.v1";
const faucetKey = "nexusdex.faucet.v1";
const routerAddress = "0x28464af7B8db8D4C934FF269244Db76a2c6f75B5";
const usdxFaucetAddress = "0x279D60ad50FF69e6926089B023c4f4460542af94";
const walletConnectProjectId = window.NEXUS_WALLETCONNECT_PROJECT_ID || "";
const NEXUS_CHAIN_ID_NUMBER = 3945;
const tokenAddresses = {
  NEX: "",
  USDX: usdxFaucetAddress,
  WETH: "",
  USDC: "",
};
const decimals = 18;
const NEXUS_TESTNET = {
  chainId: "0xf69",
  chainName: "Nexus Testnet",
  nativeCurrency: { name: "NEX", symbol: "NEX", decimals: 18 },
  rpcUrls: ["https://testnet.rpc.nexus.xyz"],
  blockExplorerUrls: ["https://testnet.explorer.nexus.xyz"],
};

const tokens = [
  { symbol: "NEX", reserve: 820000, priceUsd: 0.018 },
  { symbol: "USDX", reserve: 18500, priceUsd: 1 },
  { symbol: "WETH", reserve: 6.8, priceUsd: 3820 },
  { symbol: "USDC", reserve: 21200, priceUsd: 1 },
];

const sources = [
  { name: "Nexus Pool", fee: 0.003, depth: 1.0 },
  { name: "Kuru Book", fee: 0.0018, depth: 1.25 },
  { name: "Atlantis LP", fee: 0.0025, depth: 0.9 },
  { name: "Blue AMM", fee: 0.0035, depth: 1.45 },
];

const state = {
  swaps: loadArray(swapKey, []),
  pools: loadArray(poolKey, []),
  balances: { NEX: 0, USDX: 0, WETH: 0, USDC: 0 },
  connectedAddress: "",
  connectedChain: "",
  lastQuote: null,
};
const walletProviders = new Map();
let selectedProvider = null;

const marketPools = [
  {
    pair: "wBTC / NEX",
    type: "Stable 1%",
    apr: "1.27%",
    tvl: "$59.09K",
    tvlSub: "0.6542 wBTC / 27,890.2240 NEX",
    volume: "$206.22",
    volumeSub: "0.0028 wBTC / 499.3221 NEX",
    fees: "$2.06",
    feesSub: "0.0000 wBTC / 4.9932 NEX",
  },
  {
    pair: "NEX / WETH",
    type: "Stable 1%",
    apr: "1.60%",
    tvl: "$68.74K",
    tvlSub: "27,953.5940 NEX / 28.7943 WETH",
    volume: "$302.02",
    volumeSub: "733.4262 NEX / 0.1509 WETH",
    fees: "$3.02",
    feesSub: "7.3342 NEX / 0.0015 WETH",
  },
  {
    pair: "NEX / stNEX",
    type: "Stable 0.3%",
    apr: "0.00%",
    tvl: "$2.74K",
    tvlSub: "4,133.5936 NEX / 2,214.8175 stNEX",
    volume: "$0.38",
    volumeSub: "0.9406 NEX / 0.7973 stNEX",
    fees: "$0",
    feesSub: "0.0028 NEX / 0.0023 stNEX",
  },
  {
    pair: "NEX / USDC",
    type: "Stable 0.3%",
    apr: "0.04%",
    tvl: "$19.6K",
    tvlSub: "17,101.0744 NEX / 12,633.3529 USDC",
    volume: "$6.4",
    volumeSub: "15.5780 NEX / 6.3828 USDC",
    fees: "$0.02",
    feesSub: "0.0467 NEX / 0.0191 USDC",
  },
  {
    pair: "NEX / USDX",
    type: "Stable 1%",
    apr: "6.40%",
    tvl: "$116.78K",
    tvlSub: "87,412.4644 NEX / 80,794.6491 USDX",
    volume: "$2.05K",
    volumeSub: "4,965.3956 NEX / 2,037.4751 USDX",
    fees: "$20.48",
    feesSub: "49.6539 NEX / 20.3748 USDX",
  },
];

const $ = (selector) => document.querySelector(selector);

function loadArray(key, fallback) {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadObject(key, fallback) {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveSwaps() {
  localStorage.setItem(swapKey, JSON.stringify(state.swaps));
}

function savePools() {
  localStorage.setItem(poolKey, JSON.stringify(state.pools));
}

function saveBalances() {
  localStorage.setItem(balancesKey, JSON.stringify(state.balances));
}

function tokenBySymbol(symbol) {
  return tokens.find((token) => token.symbol === symbol);
}

function shortAddress(address) {
  if (!address || address.length < 12) return "Connect";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function reserveFor(symbol) {
  const base = tokenBySymbol(symbol)?.reserve || 0;
  const added = state.pools.reduce((sum, pool) => {
    if (pool.tokenA === symbol) return sum + pool.amountA;
    if (pool.tokenB === symbol) return sum + pool.amountB;
    return sum;
  }, 0);
  return base + added;
}

function activeProvider() {
  return selectedProvider || window.ethereum || null;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function detectProviderName(provider) {
  if (provider?.isRabby) return "Rabby";
  if (provider?.isMetaMask) return "MetaMask";
  if (provider?.isBraveWallet) return "Brave Wallet";
  if (provider?.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider?.isOKXWallet || provider?.okxwallet) return "OKX Wallet";
  if (provider?.isTrust) return "Trust Wallet";
  return "Injected Wallet";
}

function addWalletProvider(id, name, provider, icon = "") {
  if (!provider?.request) return;
  const duplicate = Array.from(walletProviders.values()).some((wallet) => wallet.provider === provider);
  if (duplicate) return;
  const safeId = `wallet-${walletProviders.size}`;
  walletProviders.set(safeId, { id: safeId, name: name || "Wallet", provider, icon });
}

function collectInjectedWallets() {
  if (!window.ethereum) return;
  const providers = Array.isArray(window.ethereum.providers) ? window.ethereum.providers : [window.ethereum];
  providers.forEach((provider, index) => {
    const name = detectProviderName(provider);
    addWalletProvider(`${name}-${index}`, name, provider);
  });
}

function requestWalletAnnouncements() {
  collectInjectedWallets();
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function setupWalletDiscovery() {
  window.addEventListener("eip6963:announceProvider", (event) => {
    const detail = event.detail || {};
    if (!detail.provider) return;
    const info = detail.info || {};
    addWalletProvider(info.rdns || info.uuid || info.name || "wallet", info.name || "Wallet", detail.provider, info.icon || "");
    renderWalletList();
  });
  requestWalletAnnouncements();
}

function renderWalletList() {
  const walletList = $("#walletList");
  if (!walletList) return;
  const wallets = Array.from(walletProviders.values());
  const injectedOptions = wallets
    .map(
      (wallet) => `
        <button class="wallet-option" type="button" data-wallet-id="${wallet.id}">
          ${
            wallet.icon
              ? `<img src="${escapeHtml(wallet.icon)}" alt="" />`
              : `<span class="wallet-option-icon">${escapeHtml(wallet.name.slice(0, 1))}</span>`
          }
          <span>${escapeHtml(wallet.name)}<small>Connect to Nexus Testnet</small></span>
        </button>
      `,
    )
    .join("");
  walletList.innerHTML = `
    <button class="wallet-option walletconnect-option" type="button" id="walletConnectOption">
      <span class="wallet-option-icon">W</span>
      <span>WalletConnect<small>QR code and mobile wallets</small></span>
    </button>
    <button class="wallet-option" type="button" id="metaMaskMobileOption">
      <span class="wallet-option-icon">M</span>
      <span>Open in MetaMask<small>Best for mobile or in-app browsers</small></span>
    </button>
    ${injectedOptions || `<div class="wallet-help">No browser extension detected. WalletConnect can still connect mobile wallets.</div>`}
  `;
  $("#walletConnectOption")?.addEventListener("click", connectWalletConnect);
  $("#metaMaskMobileOption")?.addEventListener("click", openMetaMaskMobile);
  walletList.querySelectorAll(".wallet-option").forEach((button) => {
    if (!button.dataset.walletId) return;
    button.addEventListener("click", () => {
      const wallet = walletProviders.get(button.dataset.walletId);
      if (!wallet) return;
      selectedProvider = wallet.provider;
      closeWalletModal();
      connectWallet(wallet.provider, wallet.name);
    });
  });
}

function openMetaMaskMobile() {
  const target = `${window.location.host}${window.location.pathname}${window.location.search}`;
  if (!target || target.startsWith("localhost")) {
    showSafeStatus("Deploy on Vercel, then open this link in MetaMask mobile.");
    return;
  }
  window.location.href = `https://metamask.app.link/dapp/${target}`;
}

function openWalletModal() {
  requestWalletAnnouncements();
  renderWalletList();
  const modal = $("#walletModal");
  if (modal) modal.hidden = false;
  window.setTimeout(renderWalletList, 250);
}

function closeWalletModal() {
  const modal = $("#walletModal");
  if (modal) modal.hidden = true;
}

async function connectWallet(provider = activeProvider(), walletName = "") {
  const walletButton = $("#walletButton");
  const walletLabel = $("#walletLabel");
  if (!provider) {
    openWalletModal();
    showSafeStatus("Choose a wallet to connect.");
    return false;
  }

  if (walletButton) walletButton.disabled = true;
  if (walletLabel) walletLabel.textContent = "Connecting";
  showSafeStatus(walletName ? `Opening ${walletName}...` : "Opening wallet...");

  try {
    selectedProvider = provider;
    const accounts = await requestWalletAccounts(provider);
    state.connectedAddress = accounts[0] || "";
    if (!state.connectedAddress) throw new Error("No wallet account returned.");
    if (walletLabel) walletLabel.textContent = shortAddress(state.connectedAddress);
    showSafeStatus("Switching to Nexus Testnet...");
    await switchToNexusTestnet();
    showSafeStatus("Wallet connected.");
    try {
      await refreshOnchainBalances();
    } catch (balanceError) {
      showSafeStatus("Wallet connected. Balance refresh failed.");
    }
    if (walletButton) walletButton.disabled = false;
    return Boolean(state.connectedAddress);
  } catch (error) {
    showSafeStatus(error?.message || "Wallet connection rejected.");
    if (walletLabel) walletLabel.textContent = state.connectedAddress ? shortAddress(state.connectedAddress) : "Connect";
    if (walletButton) walletButton.disabled = false;
    return false;
  }
}

async function requestWalletAccounts(provider) {
  if (typeof provider.enable === "function") {
    try {
      const accounts = await provider.enable();
      if (Array.isArray(accounts) && accounts.length) return accounts;
    } catch {
      // Fall through to the EIP-1193 request path.
    }
  }
  return provider.request({ method: "eth_requestAccounts" });
}

async function connectWalletConnect() {
  if (!walletConnectProjectId || walletConnectProjectId === "YOUR_PROJECT_ID") {
    showSafeStatus("Add your WalletConnect project id in dex.html first.");
    return false;
  }

  try {
    showSafeStatus("Loading WalletConnect...");
    const module = await import("https://esm.sh/@walletconnect/ethereum-provider@2.17.0?bundle");
    const EthereumProvider = module.default || module.EthereumProvider;
    const provider = await EthereumProvider.init({
      projectId: walletConnectProjectId,
      chains: [NEXUS_CHAIN_ID_NUMBER],
      optionalChains: [NEXUS_CHAIN_ID_NUMBER],
      rpcMap: { [NEXUS_CHAIN_ID_NUMBER]: NEXUS_TESTNET.rpcUrls[0] },
      showQrModal: true,
      metadata: {
        name: "NEXUS DEX",
        description: "NEXUS DEX swaps, faucet, and liquidity pools.",
        url: window.location.origin || "https://nexusdex.local",
        icons: [],
      },
    });
    selectedProvider = provider;
    closeWalletModal();
    return connectWallet(provider, "WalletConnect");
  } catch (error) {
    showSafeStatus(error?.message || "WalletConnect failed.");
    return false;
  }
}

async function switchToNexusTestnet() {
  const provider = activeProvider();
  if (!provider) return false;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: NEXUS_TESTNET.chainId }] });
  } catch (error) {
    if (error?.code === 4902) {
      await provider.request({ method: "wallet_addEthereumChain", params: [NEXUS_TESTNET] });
    } else {
      throw error;
    }
  }
  state.connectedChain = NEXUS_TESTNET.chainId;
  return true;
}

function showSafeStatus(message) {
  const target = $("#usdxClaimStatus");
  if (target) target.textContent = message;
  const walletStatus = $("#walletStatus");
  if (walletStatus) walletStatus.textContent = message;
}

function setupTokens() {
  const options = tokens.map((token) => `<option value="${token.symbol}">${token.symbol}</option>`).join("");
  $("#sellToken").innerHTML = options;
  $("#buyToken").innerHTML = options;
  $("#poolTokenA").innerHTML = options;
  $("#poolTokenB").innerHTML = options;
  $("#sellToken").value = "NEX";
  $("#buyToken").value = "USDX";
  $("#poolTokenA").value = "NEX";
  $("#poolTokenB").value = "USDX";
}

function buildSourceQuotes(amountIn, from, to) {
  const reserveIn = reserveFor(from.symbol);
  const reserveOut = reserveFor(to.symbol);
  return sources
    .map((source, index) => {
      const depth = reserveIn * source.depth + index * 1400;
      const impact = Math.min((amountIn / depth) * 150, 24);
      const out = (amountIn * from.priceUsd * (1 - source.fee) * (1 - impact / 100)) / to.priceUsd;
      return { ...source, impact, out };
    })
    .sort((a, b) => b.out - a.out);
}

function quoteSwap() {
  const amountIn = Number($("#sellAmount").value);
  const from = tokenBySymbol($("#sellToken").value);
  const to = tokenBySymbol($("#buyToken").value);

  if (!from || !to || from.symbol === to.symbol || !Number.isFinite(amountIn) || amountIn <= 0) {
    $("#buyAmount").value = "";
    $("#quoteBox").innerHTML = `<span>Enter an amount.</span>`;
    $("#routeList").innerHTML = "";
    $("#payUsd").textContent = "$0";
    $("#receiveUsd").textContent = "$0";
    $("#payBalance").textContent = `${formatNumber(state.balances[from?.symbol] || 0)} ${from?.symbol || ""}`;
    $("#receiveBalance").textContent = `${formatNumber(state.balances[to?.symbol] || 0)} ${to?.symbol || ""}`;
    $("#swapButton").textContent = "Enter amount";
    state.lastQuote = null;
    return null;
  }

  const ranked = buildSourceQuotes(amountIn, from, to);
  const best = ranked[0];
  const second = ranked[1];
  const splitOut = best.out * 0.7 + second.out * 0.3 * 1.003;
  const amountOut = Math.max(best.out, splitOut);
  const routeMode = amountOut > best.out ? `${best.name} 70% / ${second.name} 30%` : best.name;
  const minReceived = amountOut * (1 - Number($("#slippageInput").value) / 100);
  const rate = amountOut / amountIn;

  $("#buyAmount").value = formatNumber(amountOut);
  $("#payUsd").textContent = `$${formatNumber(amountIn * from.priceUsd)}`;
  $("#receiveUsd").textContent = `$${formatNumber(amountOut * to.priceUsd)}`;
  $("#payBalance").textContent = `${formatNumber(state.balances[from.symbol] || 0)} ${from.symbol}`;
  $("#receiveBalance").textContent = `${formatNumber(state.balances[to.symbol] || 0)} ${to.symbol}`;
  if ($("#marketRoute")) $("#marketRoute").textContent = `${from.symbol} / ${to.symbol}`;
  $("#swapButton").textContent = "Review route";
  $("#quoteBox").innerHTML = `
    <div class="quote-line"><span>Best</span><strong>${routeMode}</strong></div>
    <div class="quote-line"><span>Rate</span><strong>1 ${from.symbol} = ${formatNumber(rate)} ${to.symbol}</strong></div>
    <div class="quote-line"><span>Min</span><strong>${formatNumber(minReceived)} ${to.symbol}</strong></div>
  `;
  $("#routeList").innerHTML = ranked
    .slice(0, 3)
    .map(
      (route, index) => `
        <div class="route-item ${index === 0 ? "best" : ""}">
          <span>${route.name}</span>
          <strong>${formatNumber(route.out)} ${to.symbol}</strong>
          <em>${route.impact.toFixed(2)}% impact</em>
        </div>
      `,
    )
    .join("");

  state.lastQuote = { from, to, amountIn, amountOut, routeMode };
  return state.lastQuote;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function strip0x(value) {
  return String(value || "").replace(/^0x/i, "");
}

function word(value) {
  return strip0x(value).padStart(64, "0");
}

function addressWord(address) {
  return word(address);
}

function uintWord(value) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function parseUnits(value) {
  const raw = String(value || "0").trim();
  if (!raw || Number(raw) <= 0) return 0n;
  const [whole, fraction = ""] = raw.split(".");
  const cleanWhole = whole.replace(/\D/g, "") || "0";
  const cleanFraction = fraction.replace(/\D/g, "").slice(0, decimals).padEnd(decimals, "0");
  return BigInt(cleanWhole + cleanFraction);
}

function unitsFromNumber(value) {
  return parseUnits(Number(value || 0).toFixed(decimals));
}

function formatUnits(value) {
  const amount = BigInt(value || 0);
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = (amount % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return Number(`${whole}.${fraction || "0"}`);
}

function tokenAddress(symbol) {
  return tokenAddresses[symbol] || "";
}

function requireLiveToken(symbol) {
  const address = tokenAddress(symbol);
  if (!address) showSafeStatus(`${symbol} needs an ERC-20 contract address before live testing.`);
  return address;
}

async function readNativeBalance() {
  const provider = activeProvider();
  if (!provider) return;
  const hex = await provider.request({
    method: "eth_getBalance",
    params: [state.connectedAddress, "latest"],
  });
  state.balances.NEX = formatUnits(BigInt(hex || "0x0"));
}

async function readTokenBalance(symbol) {
  const provider = activeProvider();
  if (!provider) return;
  const address = tokenAddress(symbol);
  if (!address) {
    state.balances[symbol] = 0;
    return;
  }
  const data = `0x70a08231${addressWord(state.connectedAddress)}`;
  const hex = await provider.request({
    method: "eth_call",
    params: [{ to: address, data }, "latest"],
  });
  state.balances[symbol] = formatUnits(BigInt(hex || "0x0"));
}

async function refreshOnchainBalances() {
  if (!activeProvider() || !state.connectedAddress) return;
  await readNativeBalance();
  await Promise.all(["USDX", "WETH", "USDC"].map(readTokenBalance));
  saveBalances();
  updateBalances();
}

async function sendApproval(token, amount) {
  const provider = activeProvider();
  if (!provider) throw new Error("Wallet not connected.");
  const data = `0x095ea7b3${addressWord(routerAddress)}${uintWord(amount)}`;
  return provider.request({
    method: "eth_sendTransaction",
    params: [{ from: state.connectedAddress, to: token, data }],
  });
}

function buildSwapData(amountIn, amountOutMin, tokenIn, tokenOut) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  return [
    "0x38ed1739",
    uintWord(amountIn),
    uintWord(amountOutMin),
    uintWord(160n),
    addressWord(state.connectedAddress),
    uintWord(deadline),
    uintWord(2n),
    addressWord(tokenIn),
    addressWord(tokenOut),
  ].join("");
}

function buildAddLiquidityData(tokenA, tokenB, amountA, amountB) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  const minA = (amountA * 99n) / 100n;
  const minB = (amountB * 99n) / 100n;
  return [
    "0xe8e33700",
    addressWord(tokenA),
    addressWord(tokenB),
    uintWord(amountA),
    uintWord(amountB),
    uintWord(minA),
    uintWord(minB),
    addressWord(state.connectedAddress),
    uintWord(deadline),
  ].join("");
}

async function executeSwap() {
  const quote = quoteSwap();
  if (!quote) return;
  if (!state.connectedAddress && !(await connectWallet())) return;
  const tokenIn = requireLiveToken(quote.from.symbol);
  const tokenOut = requireLiveToken(quote.to.symbol);
  if (!tokenIn || !tokenOut) return;
  if (!routerAddress) {
    showSafeStatus("Router address missing.");
    return;
  }

  const amountIn = parseUnits($("#sellAmount").value);
  const minOut = unitsFromNumber(quote.amountOut * (1 - Number($("#slippageInput").value) / 100));
  if (amountIn <= 0n || minOut <= 0n) {
    showSafeStatus("Enter a valid amount.");
    return;
  }

  $("#swapButton").textContent = "Approve token";
  await sendApproval(tokenIn, amountIn);
  $("#swapButton").textContent = "Confirm swap";
  const txHash = await activeProvider().request({
    method: "eth_sendTransaction",
    params: [{ from: state.connectedAddress, to: routerAddress, data: buildSwapData(amountIn, minOut, tokenIn, tokenOut) }],
  });
  state.swaps.unshift({
    id: crypto.randomUUID(),
    from: quote.from.symbol,
    to: quote.to.symbol,
    amountIn: quote.amountIn,
    amountOut: quote.amountOut,
    route: quote.routeMode,
    account: state.connectedAddress,
    txHash,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  });
  state.swaps = state.swaps.slice(0, 7);
  saveSwaps();
  renderSwapLog();
  await refreshOnchainBalances();
  $("#swapButton").textContent = "Swap sent";
  window.setTimeout(() => {
    $("#swapButton").textContent = "Review route";
  }, 1200);
}

function renderSwapLog() {
  const swapLog = $("#swapLog");
  if (!state.swaps.length) {
    swapLog.innerHTML = `<div class="swap-entry"><span>No swaps yet.</span></div>`;
    return;
  }
  swapLog.innerHTML = state.swaps
    .map(
      (swap) => `
        <div class="swap-entry">
          <strong>${formatNumber(swap.amountIn)} ${swap.from} -> ${formatNumber(swap.amountOut)} ${swap.to}</strong>
          <span>${swap.txHash ? shortAddress(swap.txHash) : swap.route || "Aggregator"} - ${swap.time}</span>
        </div>
      `,
    )
    .join("");
}

async function addLiquidity() {
  const amountA = Number($("#poolAmountA").value);
  const amountB = Number($("#poolAmountB").value);
  const tokenA = $("#poolTokenA").value;
  const tokenB = $("#poolTokenB").value;
  if (!Number.isFinite(amountA) || !Number.isFinite(amountB) || amountA <= 0 || amountB <= 0 || tokenA === tokenB) {
    showSafeStatus("Enter two token amounts.");
    return;
  }
  if (!state.connectedAddress && !(await connectWallet())) return;
  const addressA = requireLiveToken(tokenA);
  const addressB = requireLiveToken(tokenB);
  if (!addressA || !addressB) return;
  if (!routerAddress) {
    showSafeStatus("Router address missing.");
    return;
  }

  const amountAWei = parseUnits($("#poolAmountA").value);
  const amountBWei = parseUnits($("#poolAmountB").value);
  showSafeStatus(`Approve ${tokenA}`);
  await sendApproval(addressA, amountAWei);
  showSafeStatus(`Approve ${tokenB}`);
  await sendApproval(addressB, amountBWei);
  showSafeStatus("Confirm liquidity");
  const txHash = await activeProvider().request({
    method: "eth_sendTransaction",
    params: [{ from: state.connectedAddress, to: routerAddress, data: buildAddLiquidityData(addressA, addressB, amountAWei, amountBWei) }],
  });
  state.pools.unshift({
    id: crypto.randomUUID(),
    tokenA,
    tokenB,
    amountA,
    amountB,
    txHash,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  });
  state.pools = state.pools.slice(0, 7);
  savePools();
  renderPools();
  quoteSwap();
  await refreshOnchainBalances();
  $("#poolAmountA").value = "";
  $("#poolAmountB").value = "";
}

function renderPools() {
  const poolList = $("#poolList");
  if (!state.pools.length) {
    poolList.innerHTML = `<div class="pool-item"><span>No liquidity yet.</span><span>Live positions</span></div>`;
    updatePoolStats();
    return;
  }

  poolList.innerHTML = state.pools
    .map(
      (pool) => `
        <div class="pool-item">
          <span>${formatNumber(pool.amountA)} ${pool.tokenA} / ${formatNumber(pool.amountB)} ${pool.tokenB}</span>
          <span>${pool.txHash ? shortAddress(pool.txHash) : pool.time}</span>
        </div>
      `,
    )
    .join("");
  updatePoolStats();
  renderPoolTable();
}

function updatePoolStats() {
  const value = state.pools.reduce((sum, pool) => {
    const tokenA = tokenBySymbol(pool.tokenA);
    const tokenB = tokenBySymbol(pool.tokenB);
    return sum + pool.amountA * (tokenA?.priceUsd || 0) + pool.amountB * (tokenB?.priceUsd || 0);
  }, 0);
  $("#poolValue").textContent = `$${formatNumber(value)}`;
  $("#poolCount").textContent = String(state.pools.length);
  $("#usdxBalance").textContent = formatNumber(state.balances.USDX || 0);
}

async function claimUsdxFaucet() {
  if (!state.connectedAddress && !(await connectWallet())) return;
  const lastClaim = Number(localStorage.getItem(faucetKey) || 0);
  const now = Date.now();
  const cooldown = 6 * 60 * 60 * 1000;
  if (now - lastClaim < cooldown) {
    const hours = Math.ceil((cooldown - (now - lastClaim)) / 3600000);
    showSafeStatus(`Cooldown ${hours}h`);
    return;
  }

  if (usdxFaucetAddress && activeProvider()) {
    await activeProvider().request({
      method: "eth_sendTransaction",
      params: [{ from: state.connectedAddress, to: usdxFaucetAddress, data: "0x4e71d92d" }],
    });
  }

  localStorage.setItem(faucetKey, String(now));
  await refreshOnchainBalances();
  showSafeStatus("Claimed 10 USDX");
}

function updateBalances() {
  const sell = $("#sellToken")?.value || "NEX";
  const buy = $("#buyToken")?.value || "USDX";
  if ($("#payBalance")) $("#payBalance").textContent = `${formatNumber(state.balances[sell] || 0)} ${sell}`;
  if ($("#receiveBalance")) $("#receiveBalance").textContent = `${formatNumber(state.balances[buy] || 0)} ${buy}`;
  if ($("#usdxBalance")) $("#usdxBalance").textContent = formatNumber(state.balances.USDX || 0);
  const pill = $("#walletBalance");
  if (pill && state.connectedAddress) {
    pill.hidden = false;
    pill.textContent = `${formatNumber(state.balances.NEX || 0)} NEX`;
  }
}

function focusCreatePosition() {
  document.querySelector(".quick-pool")?.scrollIntoView({ behavior: "smooth", block: "center" });
  $("#poolAmountA")?.focus();
}

function renderPoolTable() {
  const body = $("#poolTableBody");
  if (!body) return;
  const query = ($("#poolSearch")?.value || "").trim().toLowerCase();
  const rows = marketPools.filter((pool) => pool.pair.toLowerCase().includes(query));
  body.innerHTML = rows
    .map((pool) => {
      const [a, b] = pool.pair.split(" / ");
      return `
        <div class="pool-row">
          <div class="pool-pair">
            <div class="token-stack">
              <span class="token-dot">${a.slice(0, 2)}</span>
              <span class="token-dot">${b.slice(0, 2)}</span>
            </div>
            <div><strong>${pool.pair}</strong><span>${pool.type}</span></div>
          </div>
          <div><span class="apr-pill">${pool.apr}</span></div>
          <div class="pool-metric"><strong>${pool.tvl}</strong><span>${pool.tvlSub}</span></div>
          <div class="pool-metric"><strong>${pool.volume}</strong><span>${pool.volumeSub}</span></div>
          <div class="pool-metric"><strong>${pool.fees}</strong><span>${pool.feesSub}</span></div>
          <button class="deposit-button" type="button">Deposit</button>
        </div>
      `;
    })
    .join("");
}

function initDex() {
  setupTokens();
  updateBalances();
  quoteSwap();
  renderSwapLog();
  renderPools();

  ["#sellAmount", "#sellToken", "#buyToken", "#slippageInput", "#deadlineInput"].forEach((selector) => {
    $(selector).addEventListener("input", quoteSwap);
    $(selector).addEventListener("change", quoteSwap);
  });

  $("#switchTokens").addEventListener("click", () => {
    const nextSell = $("#buyToken").value;
    $("#buyToken").value = $("#sellToken").value;
    $("#sellToken").value = nextSell;
    quoteSwap();
  });
  $("#refreshQuote").addEventListener("click", quoteSwap);
  $("#swapButton").addEventListener("click", executeSwap);
  $("#addLiquidityButton").addEventListener("click", addLiquidity);
  $("#walletButton").addEventListener("click", openWalletModal);
  $("#walletModalClose")?.addEventListener("click", closeWalletModal);
  $("#walletModal")?.addEventListener("click", (event) => {
    if (event.target === $("#walletModal")) closeWalletModal();
  });
  $("#poolSearch")?.addEventListener("input", renderPoolTable);
  $("#createPositionButton")?.addEventListener("click", focusCreatePosition);
  $("#usdxFaucetButton")?.addEventListener("click", claimUsdxFaucet);
  renderPoolTable();
  setupWalletDiscovery();

  if (activeProvider()) {
    selectedProvider = activeProvider();
    activeProvider()
      .request({ method: "eth_accounts" })
      .then(async (accounts) => {
        state.connectedAddress = accounts?.[0] || "";
        if (!state.connectedAddress) return;
        $("#walletLabel").textContent = shortAddress(state.connectedAddress);
        try {
          await refreshOnchainBalances();
        } catch (balanceError) {
          showSafeStatus("Wallet connected. Balance refresh failed.");
        }
      })
      .catch(() => {});
  } else {
    showSafeStatus("Wallet not detected in this browser.");
  }
}

initDex();
