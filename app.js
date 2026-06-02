const NEXUS_CHAIN = {
  chainId: "0xf69",
  chainName: "Nexus Testnet",
  nativeCurrency: { name: "NEX", symbol: "NEX", decimals: 18 },
  rpcUrls: ["https://testnet.rpc.nexus.xyz"],
  blockExplorerUrls: ["https://testnet.explorer.nexus.xyz"],
};

const NEXUS_CHAIN_ID = 3945;
const ROUTER_ADDRESS = "0x329fB90b98C978C6E224b2f817D05Ad01BFBF4De";
const USDX_ADDRESS = "0x5a0cBf89795e66Ba5480C01a591D2B5cfA4A2AC9";
const WNEX_ADDRESS = "0x8a2f1fe2E4Ae4b4E15689810529d532F9e9a7645";
const WALLETCONNECT_PROJECT_ID = window.NEXUS_WALLETCONNECT_PROJECT_ID || "";
const CLAIM_SELECTOR = "0x4e71d92d";
const DECIMALS = 18n;
const GAS_LIMITS = {
  claimUsdx: "0x249f0",
  wrapNex: "0x1d4c0",
  approve: "0x186a0",
  swap: "0x7a120",
  addLiquidity: "0x989680",
};

const tokens = {
  WNEX: { symbol: "WNEX", address: WNEX_ADDRESS, price: 0.018 },
  USDX: { symbol: "USDX", address: USDX_ADDRESS, price: 1 },
  WETH: { symbol: "WETH", address: "", price: 3820 },
  USDC: { symbol: "USDC", address: "", price: 1 },
};

const pools = [
  ["WNEX / USDX", "6.40%", "$116.78K", "$2.05K", "$20.48"],
  ["WNEX / USDC", "0.04%", "$19.6K", "$6.40", "$0.02"],
  ["WNEX / WETH", "1.60%", "$68.74K", "$302.02", "$3.02"],
  ["wBTC / WNEX", "1.27%", "$59.09K", "$206.22", "$2.06"],
];

const state = {
  provider: null,
  account: "",
  balances: { NEX: 0, WNEX: 0, USDX: 0, WETH: 0, USDC: 0 },
  wallets: new Map(),
};

const $ = (selector) => document.querySelector(selector);
const setText = (selector, value) => {
  const node = $(selector);
  if (node) node.textContent = value;
};

function setStatus(message) {
  setText("#walletStatus", message);
  setText("#usdxClaimStatus", message);
}

function shortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connect";
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char];
  });
}

function providerName(provider) {
  if (provider?.isRabby) return "Rabby";
  if (provider?.isMetaMask) return "MetaMask";
  if (provider?.isBraveWallet) return "Brave Wallet";
  if (provider?.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider?.isOKXWallet || provider?.okxwallet) return "OKX Wallet";
  if (provider?.isTrust) return "Trust Wallet";
  return "Browser Wallet";
}

function addProvider(name, provider, icon = "") {
  if (!provider?.request) return;
  const duplicate = Array.from(state.wallets.values()).some((wallet) => wallet.provider === provider);
  if (duplicate) return;
  const id = `wallet-${state.wallets.size}`;
  state.wallets.set(id, { id, name, provider, icon });
}

function scanWallets() {
  if (window.ethereum) {
    const providers = Array.isArray(window.ethereum.providers) ? window.ethereum.providers : [window.ethereum];
    providers.forEach((provider) => addProvider(providerName(provider), provider));
  }
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function setupEip6963() {
  window.addEventListener("eip6963:announceProvider", (event) => {
    const detail = event.detail || {};
    if (!detail.provider) return;
    addProvider(detail.info?.name || "Wallet", detail.provider, detail.info?.icon || "");
    renderWallets();
  });
}

function renderWallets() {
  const list = $("#walletList");
  if (!list) return;

  if (state.account) {
    list.innerHTML = `
      <button class="wallet-option" type="button" id="disconnectWalletOption">
        <span class="wallet-option-icon">D</span>
        <span>Disconnect wallet<small>${escapeHtml(shortAddress(state.account))}</small></span>
      </button>
    `;
    $("#disconnectWalletOption")?.addEventListener("click", disconnectWallet);
    return;
  }

  const injected = Array.from(state.wallets.values())
    .map((wallet) => {
      const icon = wallet.icon
        ? `<img src="${escapeHtml(wallet.icon)}" alt="" />`
        : `<span class="wallet-option-icon">${escapeHtml(wallet.name[0] || "W")}</span>`;
      return `
        <button class="wallet-option" type="button" data-wallet="${wallet.id}">
          ${icon}
          <span>${escapeHtml(wallet.name)}<small>Connect account only</small></span>
        </button>
      `;
    })
    .join("");

  list.innerHTML = `
    ${injected}
    <button class="wallet-option" type="button" id="walletConnectOption">
      <span class="wallet-option-icon">W</span>
      <span>WalletConnect<small>Account access only</small></span>
    </button>
    <button class="wallet-option" type="button" id="metaMaskMobileOption">
      <span class="wallet-option-icon">M</span>
      <span>Open in MetaMask<small>Mobile browser fallback</small></span>
    </button>
    ${injected ? "" : `<p class="wallet-help">No extension wallet is injecting into this page. Try WalletConnect, MetaMask mobile, or open the Vercel URL directly in Chrome/Brave.</p>`}
  `;

  list.querySelectorAll("[data-wallet]").forEach((button) => {
    button.addEventListener("click", () => {
      const wallet = state.wallets.get(button.dataset.wallet);
      if (wallet) connectProvider(wallet.provider, wallet.name);
    });
  });
  $("#walletConnectOption")?.addEventListener("click", connectWalletConnect);
  $("#metaMaskMobileOption")?.addEventListener("click", openMetaMaskMobile);
}

function openWalletModal() {
  scanWallets();
  renderWallets();
  const modal = $("#walletModal");
  if (modal) modal.hidden = false;
  setTimeout(() => {
    scanWallets();
    renderWallets();
  }, 300);
}

function closeWalletModal() {
  const modal = $("#walletModal");
  if (modal) modal.hidden = true;
}

function disconnectWallet() {
  state.provider = null;
  state.account = "";
  state.balances = { NEX: 0, WNEX: 0, USDX: 0, WETH: 0, USDC: 0 };
  setText("#walletLabel", "Connect");
  const pill = $("#walletBalance");
  if (pill) pill.hidden = true;
  updateBalances();
  updateSwapButton();
  closeWalletModal();
  setStatus("Wallet disconnected.");
}

async function requestAccounts(provider) {
  return provider.request({ method: "eth_requestAccounts" });
}

async function switchNetwork(provider) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: NEXUS_CHAIN.chainId }] });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [NEXUS_CHAIN] });
  }
}

async function connectProvider(provider, name = "Wallet") {
  const walletButton = $("#walletButton");
  if (walletButton) walletButton.disabled = true;
  setText("#walletLabel", "Connecting");
  setStatus(`Opening ${name}...`);

  try {
    state.provider = provider;
    const accounts = await requestAccounts(provider);
    state.account = accounts?.[0] || "";
    if (!state.account) throw new Error("No account returned by wallet.");

    setText("#walletLabel", shortAddress(state.account));
    setStatus("Switching to Nexus Testnet...");
    await switchNetwork(provider);
    closeWalletModal();
    setStatus("Wallet connected.");
    await refreshBalances();
    updateSwapButton();
    return true;
  } catch (error) {
    setText("#walletLabel", state.account ? shortAddress(state.account) : "Connect");
    setStatus(error?.message || "Wallet connection rejected.");
    return false;
  } finally {
    if (walletButton) walletButton.disabled = false;
  }
}

async function connectWalletConnect() {
  if (!WALLETCONNECT_PROJECT_ID) {
    setStatus("Add WalletConnect project id in dex.html.");
    return;
  }

  try {
    setStatus("Loading WalletConnect...");
    const mod = await import("https://esm.sh/@walletconnect/ethereum-provider@2.17.0?bundle");
    const EthereumProvider = mod.default || mod.EthereumProvider;
    const provider = await EthereumProvider.init({
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [NEXUS_CHAIN_ID],
      optionalChains: [NEXUS_CHAIN_ID],
      rpcMap: { [NEXUS_CHAIN_ID]: NEXUS_CHAIN.rpcUrls[0] },
      showQrModal: true,
      metadata: {
        name: "NEXUS DEX",
        description: "NEXUS DEX on Nexus Testnet",
        url: window.location.origin,
        icons: [],
      },
    });
    await connectProvider(provider, "WalletConnect");
  } catch (error) {
    setStatus(error?.message || "WalletConnect failed.");
  }
}

function openMetaMaskMobile() {
  if (!location.hostname || location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    setStatus("Use your Vercel URL for MetaMask mobile deep link.");
    return;
  }
  const target = `${location.host}${location.pathname}${location.search}`;
  location.href = `https://metamask.app.link/dapp/${target}`;
}

function toWord(value) {
  return String(value).replace(/^0x/i, "").padStart(64, "0");
}

function uintWord(value) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function addressWord(address) {
  return toWord(address);
}

function hexValue(value) {
  return `0x${BigInt(value).toString(16)}`;
}

function parseUnits(value) {
  const raw = String(value || "0").trim();
  const [whole, fraction = ""] = raw.split(".");
  const wholePart = whole.replace(/\D/g, "") || "0";
  const fractionPart = fraction.replace(/\D/g, "").slice(0, Number(DECIMALS)).padEnd(Number(DECIMALS), "0");
  return BigInt(`${wholePart}${fractionPart}`);
}

function unitsFromNumber(value) {
  if (!Number.isFinite(value) || value <= 0) return 0n;
  return parseUnits(value.toFixed(Number(DECIMALS)));
}

function formatUnits(value) {
  const amount = BigInt(value || 0);
  const base = 10n ** DECIMALS;
  const whole = amount / base;
  const fraction = (amount % base).toString().padStart(Number(DECIMALS), "0").replace(/0+$/, "");
  return Number(`${whole}.${fraction || "0"}`);
}

async function readErc20Balance(symbol) {
  const token = tokens[symbol];
  if (!state.provider || !token?.address || !state.account) return 0;
  const data = `0x70a08231${toWord(state.account)}`;
  const result = await state.provider.request({
    method: "eth_call",
    params: [{ to: token.address, data }, "latest"],
  });
  return formatUnits(BigInt(result || "0x0"));
}

async function refreshBalances() {
  if (!state.provider || !state.account) return;
  try {
    const nexHex = await state.provider.request({ method: "eth_getBalance", params: [state.account, "latest"] });
    state.balances.NEX = formatUnits(BigInt(nexHex || "0x0"));
    state.balances.WNEX = await readErc20Balance("WNEX");
    state.balances.USDX = await readErc20Balance("USDX");
    updateBalances();
  } catch (error) {
    setStatus("RPC is busy. Transaction may still work; retry balances later.");
  }
}

async function approveToken(tokenAddress, amount) {
  const data = `0x095ea7b3${addressWord(ROUTER_ADDRESS)}${uintWord(amount)}`;
  return state.provider.request({
    method: "eth_sendTransaction",
    params: [{ from: state.account, to: tokenAddress, data, gas: GAS_LIMITS.approve }],
  });
}

function swapData(amountIn, amountOutMin, tokenIn, tokenOut) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  return [
    "0x38ed1739",
    uintWord(amountIn),
    uintWord(amountOutMin),
    uintWord(160n),
    addressWord(state.account),
    uintWord(deadline),
    uintWord(2n),
    addressWord(tokenIn),
    addressWord(tokenOut),
  ].join("");
}

function addLiquidityData(tokenA, tokenB, amountA, amountB) {
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
    addressWord(state.account),
    uintWord(deadline),
  ].join("");
}

function updateBalances() {
  const sell = $("#sellToken")?.value || "NEX";
  const buy = $("#buyToken")?.value || "USDX";
  setText("#payBalance", `${formatNumber(state.balances[sell] || 0)} ${sell}`);
  setText("#receiveBalance", `${formatNumber(state.balances[buy] || 0)} ${buy}`);
  setText("#usdxBalance", formatNumber(state.balances.USDX || 0));

  const pill = $("#walletBalance");
  if (pill && state.account) {
    pill.hidden = false;
    pill.textContent = `${formatNumber(state.balances.NEX || 0)} NEX`;
  }
}

function updateSafetyPreview(sell = $("#sellToken")?.value || "WNEX", amount = 0) {
  const approval = amount > 0 ? `${formatNumber(amount)} ${sell}` : "Exact amount only";
  setText("#approvalPreview", approval);
  setText("#contractPreview", shortAddress(ROUTER_ADDRESS));
}

function setSwapButtonState(label, stateName) {
  const button = $("#swapButton");
  if (!button) return;
  button.textContent = label;
  button.classList.remove("needs-wallet", "enter-amount", "ready", "pending");
  button.classList.add(stateName);
}

function quoteSwap() {
  const sell = $("#sellToken")?.value || "NEX";
  const buy = $("#buyToken")?.value || "USDX";
  const amount = Number($("#sellAmount")?.value || 0);
  const from = tokens[sell];
  const to = tokens[buy];

  updateBalances();
  updateSafetyPreview(sell, amount);
  if (!state.account) {
    if ($("#buyAmount")) $("#buyAmount").value = "";
    setText("#payUsd", "$0");
    setText("#receiveUsd", "$0");
    setText("#quoteBox", "Connect wallet to start.");
    setSwapButtonState("Connect wallet", "needs-wallet");
    return null;
  }
  if (!from || !to || sell === buy || !Number.isFinite(amount) || amount <= 0) {
    if ($("#buyAmount")) $("#buyAmount").value = "";
    setText("#payUsd", "$0");
    setText("#receiveUsd", "$0");
    setText("#quoteBox", "Enter an amount.");
    setSwapButtonState("Enter amount", "enter-amount");
    return null;
  }

  const amountOut = (amount * from.price * 0.997) / to.price;
  if ($("#buyAmount")) $("#buyAmount").value = formatNumber(amountOut);
  setText("#payUsd", `$${formatNumber(amount * from.price)}`);
  setText("#receiveUsd", `$${formatNumber(amountOut * to.price)}`);
  const quoteBox = $("#quoteBox");
  if (quoteBox) {
    quoteBox.innerHTML = `
      <div class="quote-line"><span>Route</span><strong>NEXUS DEX</strong></div>
      <div class="quote-line"><span>Est. receive</span><strong>${formatNumber(amountOut)} ${buy}</strong></div>
    `;
  }
  setSwapButtonState("Review swap", "ready");
  return { sell, buy, amount, amountOut };
}

function updateSwapButton() {
  quoteSwap();
}

async function ensureConnected() {
  if (state.account && state.provider) return true;
  openWalletModal();
  setStatus("Choose a wallet first.");
  return false;
}

async function claimUsdx() {
  if (!(await ensureConnected())) return;
  try {
    setStatus("Confirm USDX faucet transaction...");
    await state.provider.request({
      method: "eth_sendTransaction",
      params: [{ from: state.account, to: USDX_ADDRESS, data: CLAIM_SELECTOR, gas: GAS_LIMITS.claimUsdx }],
    });
    setStatus("USDX claim sent. Refresh balances after confirmation.");
  } catch (error) {
    setStatus(error?.message || "USDX claim failed.");
  }
}

async function wrapNex() {
  if (!(await ensureConnected())) return;
  if (!WNEX_ADDRESS) {
    setStatus("Deploy WrappedNEX and set WNEX_ADDRESS in app.js first.");
    return;
  }
  const amount = parseUnits($("#wrapAmount")?.value || "0");
  if (amount <= 0n) {
    setStatus("Enter NEX amount to wrap.");
    return;
  }
  try {
    setStatus("Confirm wrap NEX transaction...");
    await state.provider.request({
      method: "eth_sendTransaction",
      params: [{ from: state.account, to: WNEX_ADDRESS, value: hexValue(amount), data: "0xd0e30db0", gas: GAS_LIMITS.wrapNex }],
    });
    setStatus("Wrap transaction sent. Refresh balances after confirmation.");
  } catch (error) {
    setStatus(error?.message || "Wrap failed.");
  }
}

async function executeSwap() {
  if (!state.account || !state.provider) {
    openWalletModal();
    setStatus("Connect wallet first.");
    return;
  }
  const quote = quoteSwap();
  if (!quote) return;
  const tokenIn = tokens[quote.sell]?.address;
  const tokenOut = tokens[quote.buy]?.address;
  if (!tokenIn || !tokenOut) {
    setStatus("Set live ERC-20 addresses first. Use WNEX, not native NEX, for swaps.");
    return;
  }
  try {
    const amountIn = parseUnits($("#sellAmount")?.value || "0");
    const minOut = unitsFromNumber(quote.amountOut * 0.99);
    if (amountIn <= 0n || minOut <= 0n) {
      setStatus("Enter a valid swap amount.");
      return;
    }
    setSwapButtonState("Approve exact amount", "pending");
    await approveToken(tokenIn, amountIn);
    setSwapButtonState("Review swap tx", "pending");
    await state.provider.request({
      method: "eth_sendTransaction",
      params: [{ from: state.account, to: ROUTER_ADDRESS, data: swapData(amountIn, minOut, tokenIn, tokenOut), gas: GAS_LIMITS.swap }],
    });
    setStatus("Swap transaction sent.");
    setSwapButtonState("Swap sent", "pending");
    setTimeout(refreshBalances, 2500);
  } catch (error) {
    setStatus(error?.message || "Swap failed.");
    setSwapButtonState("Review swap", "ready");
  }
}

async function addLiquidity() {
  if (!(await ensureConnected())) return;
  const tokenA = $("#poolTokenA")?.value || "NEX";
  const tokenB = $("#poolTokenB")?.value || "USDX";
  if (!tokens[tokenA]?.address || !tokens[tokenB]?.address) {
    setStatus("LP needs two ERC-20 addresses. Use WNEX + USDX after deploying WrappedNEX.");
    return;
  }
  const amountA = parseUnits($("#poolAmountA")?.value || "0");
  const amountB = parseUnits($("#poolAmountB")?.value || "0");
  if (amountA <= 0n || amountB <= 0n) {
    setStatus("Enter both liquidity amounts.");
    return;
  }
  try {
    setStatus(`Approve exact ${tokenA} amount`);
    await approveToken(tokens[tokenA].address, amountA);
    setStatus(`Approve exact ${tokenB} amount`);
    await approveToken(tokens[tokenB].address, amountB);
    setStatus("Review add liquidity tx");
    await state.provider.request({
      method: "eth_sendTransaction",
      params: [{
        from: state.account,
        to: ROUTER_ADDRESS,
        data: addLiquidityData(tokens[tokenA].address, tokens[tokenB].address, amountA, amountB),
        gas: GAS_LIMITS.addLiquidity,
      }],
    });
    setStatus("Liquidity transaction sent.");
    setTimeout(refreshBalances, 2500);
  } catch (error) {
    setStatus(error?.message || "Add liquidity failed.");
  }
}

function setupTokens() {
  const options = Object.keys(tokens).map((symbol) => `<option value="${symbol}">${symbol}</option>`).join("");
  ["#sellToken", "#buyToken", "#poolTokenA", "#poolTokenB"].forEach((selector) => {
    const node = $(selector);
    if (node) node.innerHTML = options;
  });
  if ($("#sellToken")) $("#sellToken").value = "WNEX";
  if ($("#buyToken")) $("#buyToken").value = "USDX";
  if ($("#poolTokenA")) $("#poolTokenA").value = "WNEX";
  if ($("#poolTokenB")) $("#poolTokenB").value = "USDX";
}

function renderPoolTable() {
  const body = $("#poolTableBody");
  if (!body) return;
  const query = ($("#poolSearch")?.value || "").toLowerCase();
  body.innerHTML = pools
    .filter(([pair]) => pair.toLowerCase().includes(query))
    .map(([pair, apr, tvl, volume, fees]) => {
      const [a, b] = pair.split(" / ");
      return `
        <div class="pool-row">
          <div class="pool-pair">
            <div class="token-stack"><span class="token-dot">${a.slice(0, 2)}</span><span class="token-dot">${b.slice(0, 2)}</span></div>
            <div><strong>${pair}</strong><span>Stable 0.3%</span></div>
          </div>
          <div><span class="apr-pill">${apr}</span></div>
          <div class="pool-metric"><strong>${tvl}</strong><span>Testnet pool</span></div>
          <div class="pool-metric"><strong>${volume}</strong><span>24h volume</span></div>
          <div class="pool-metric"><strong>${fees}</strong><span>24h fees</span></div>
          <button class="deposit-button" type="button">Deposit</button>
        </div>
      `;
    })
    .join("");
}

function renderStaticPanels() {
  setText("#poolValue", "$0");
  setText("#poolCount", "0");
  const poolList = $("#poolList");
  if (poolList) poolList.innerHTML = `<div class="pool-item"><span>No liquidity yet.</span><span>Live only</span></div>`;
  const swapLog = $("#swapLog");
  if (swapLog) swapLog.innerHTML = `<div class="swap-entry"><span>No swaps yet.</span></div>`;
}

function bindEvents() {
  $("#walletButton")?.addEventListener("click", openWalletModal);
  $("#walletModalClose")?.addEventListener("click", closeWalletModal);
  $("#walletModal")?.addEventListener("click", (event) => {
    if (event.target === $("#walletModal")) closeWalletModal();
  });
  $("#switchTokens")?.addEventListener("click", () => {
    const sell = $("#sellToken");
    const buy = $("#buyToken");
    if (!sell || !buy) return;
    const next = sell.value;
    sell.value = buy.value;
    buy.value = next;
    quoteSwap();
  });
  ["#sellAmount", "#sellToken", "#buyToken", "#slippageInput", "#deadlineInput"].forEach((selector) => {
    const node = $(selector);
    node?.addEventListener("input", quoteSwap);
    node?.addEventListener("change", quoteSwap);
  });
  $("#refreshQuote")?.addEventListener("click", quoteSwap);
  $("#swapButton")?.addEventListener("click", executeSwap);
  $("#usdxFaucetButton")?.addEventListener("click", claimUsdx);
  $("#wrapButton")?.addEventListener("click", wrapNex);
  $("#addLiquidityButton")?.addEventListener("click", addLiquidity);
  $("#poolSearch")?.addEventListener("input", renderPoolTable);
  $("#createPositionButton")?.addEventListener("click", () => {
    document.querySelector(".quick-pool")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.querySelectorAll("[data-page-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showPage(link.dataset.pageLink);
    });
  });
}

function showPage(page) {
  const next = page || "swap";
  document.querySelectorAll("[data-page]").forEach((section) => {
    section.classList.toggle("active", section.dataset.page === next);
  });
  document.querySelectorAll("[data-page-link]").forEach((link) => {
    link.classList.toggle("active", link.dataset.pageLink === next);
  });
  history.replaceState(null, "", `#${next}`);
}

async function restoreConnection() {
  scanWallets();
  const provider = window.ethereum || Array.from(state.wallets.values())[0]?.provider;
  if (!provider?.request) {
    setStatus("No injected wallet detected. Use WalletConnect or open in MetaMask.");
    return;
  }
  state.provider = provider;
  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    state.account = accounts?.[0] || "";
    if (!state.account) return;
    setText("#walletLabel", shortAddress(state.account));
    await refreshBalances();
    updateSwapButton();
  } catch {
    setStatus("Wallet detected. Click Connect.");
  }
}

function init() {
  setupEip6963();
  setupTokens();
  bindEvents();
  renderStaticPanels();
  renderPoolTable();
  quoteSwap();
  showPage((location.hash || "#swap").slice(1));
  restoreConnection();
}

init();
